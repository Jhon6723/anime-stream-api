import { Injectable, Logger } from '@nestjs/common';
import { Provider, VideoSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderAccountService } from '../providers/provider-account.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';

@Injectable()
export class VideoSourceSyncService {
  private readonly logger = new Logger(VideoSourceSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly accountService: ProviderAccountService,
  ) {}

  async syncPendingSources(
    videoSources: Array<{
      id: string;
      provider: Provider;
      status: VideoSourceStatus;
      remoteTrackingId: string | null;
    }>,
  ): Promise<void> {
    const pending = videoSources.filter(
      (vs) => vs.status === 'UPLOADING' && vs.remoteTrackingId,
    );

    if (pending.length === 0) return;

    await Promise.allSettled(
      pending.map((vs) =>
        this.syncOne(vs.id, vs.provider, vs.remoteTrackingId!),
      ),
    );
  }

  private async syncOne(
    videoSourceId: string,
    provider: Provider,
    trackingId: string,
  ): Promise<void> {
    try {
      const adapter = this.registry.get(provider);
      const apiKey = await this.accountService.resolveDecryptedApiKey(provider);
      const result = await adapter.checkRemoteUpload(trackingId, apiKey);

      if (result.status === 'COMPLETED' && result.providerFileId) {
        await this.prisma.videoSource.update({
          where: { id: videoSourceId },
          data: {
            providerFileId: result.providerFileId,
            embedUrl: result.embedUrl,
            downloadUrl: result.downloadUrl,
            status: 'READY',
          },
        });
        this.logger.log(
          `Synced videoSource ${videoSourceId}: ${provider} -> READY (${result.providerFileId})`,
        );

        await this.fetchAndSaveThumbnail(
          videoSourceId,
          provider,
          result.providerFileId,
          apiKey,
        );
      } else if (result.status === 'FAILED') {
        await this.prisma.videoSource.update({
          where: { id: videoSourceId },
          data: { status: 'ERROR' },
        });
        this.logger.warn(
          `Synced videoSource ${videoSourceId}: ${provider} -> FAILED`,
        );
      }
    } catch (err) {
      this.logger.debug(
        `Sync skipped for ${videoSourceId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async fetchAndSaveThumbnail(
    videoSourceId: string,
    provider: Provider,
    providerFileId: string,
    apiKey: string,
  ): Promise<void> {
    try {
      const adapter = this.registry.get(provider);
      const thumbnailUrl = await adapter.getThumbnail(providerFileId, apiKey);

      if (!thumbnailUrl) {
        this.logger.debug(
          `No thumbnail returned by ${provider} for ${providerFileId}`,
        );
        return;
      }

      const videoSource = await this.prisma.videoSource.findUnique({
        where: { id: videoSourceId },
        select: { episodeId: true },
      });

      if (!videoSource) return;

      await this.prisma.episode.updateMany({
        where: {
          id: videoSource.episodeId,
          thumbnailUrl: null,
        },
        data: { thumbnailUrl },
      });

      this.logger.log(
        `Saved thumbnail for episode ${videoSource.episodeId}: ${thumbnailUrl}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to fetch thumbnail for ${videoSourceId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
