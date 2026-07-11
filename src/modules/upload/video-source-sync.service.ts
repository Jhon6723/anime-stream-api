import { Injectable, Logger } from '@nestjs/common';
import { Provider, VideoSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../websocket/events.gateway';
import { ProviderAccountService } from '../providers/provider-account.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';

@Injectable()
export class VideoSourceSyncService {
  private readonly logger = new Logger(VideoSourceSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly accountService: ProviderAccountService,
    private readonly events: EventsGateway,
  ) {}

  async syncPendingSources(
    videoSources: Array<{
      id: string;
      provider: Provider;
      status: VideoSourceStatus;
      remoteTrackingId: string | null;
      providerFileId?: string | null;
    }>,
  ): Promise<void> {
    const pending = videoSources.filter(
      (vs) =>
        (vs.status === 'UPLOADING' || vs.status === 'ENCODING') &&
        (vs.remoteTrackingId || vs.providerFileId),
    );

    if (pending.length === 0) return;

    await Promise.allSettled(
      pending.map((vs) => {
        if (vs.remoteTrackingId) {
          return this.syncOne(vs.id, vs.provider, vs.remoteTrackingId);
        }
        return this.syncEncodingFile(
          vs.id,
          vs.provider,
          vs.providerFileId!,
        );
      }),
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

        const updatedJobs = await this.prisma.uploadJob.updateMany({
          where: { videoSourceId, status: 'PROCESSING' },
          data: { status: 'COMPLETED' },
        });
        if (updatedJobs.count > 0) {
          const jobs = await this.prisma.uploadJob.findMany({
            where: { videoSourceId, status: 'COMPLETED' },
            select: { id: true },
          });
          for (const job of jobs) {
            this.events.emitUploadStatus(job.id, 'COMPLETED');
          }
          this.logger.log(
            `Marked ${updatedJobs.count} uploadJob(s) as COMPLETED for videoSource ${videoSourceId}`,
          );
        }

        await this.fetchAndSaveThumbnail(
          videoSourceId,
          provider,
          result.providerFileId,
          apiKey,
        );
      } else if (result.status === 'FAILED') {
        // Fallback: if the videoSource already has a providerFileId,
        // the remote upload may have reported an error but the file
        // could already be available on the provider.
        const existing = await this.prisma.videoSource.findUnique({
          where: { id: videoSourceId },
          select: { providerFileId: true },
        });

        if (existing?.providerFileId) {
          try {
            const info = await adapter.getFileInfo(
              existing.providerFileId,
              apiKey,
            );
            if (info.status === 'READY') {
              await this.prisma.videoSource.update({
                where: { id: videoSourceId },
                data: { status: 'READY' },
              });
              this.logger.log(
                `Synced videoSource ${videoSourceId}: ${provider} -> READY (via fileinfo fallback after remote upload error)`,
              );

              const updatedJobs = await this.prisma.uploadJob.updateMany({
                where: { videoSourceId, status: 'PROCESSING' },
                data: { status: 'COMPLETED' },
              });
              if (updatedJobs.count > 0) {
                const jobs = await this.prisma.uploadJob.findMany({
                  where: { videoSourceId, status: 'COMPLETED' },
                  select: { id: true },
                });
                for (const job of jobs) {
                  this.events.emitUploadStatus(job.id, 'COMPLETED');
                }
              }

              await this.fetchAndSaveThumbnail(
                videoSourceId,
                provider,
                existing.providerFileId,
                apiKey,
              );
              return;
            }
          } catch {
            // getFileInfo also failed, fall through to mark as DELETED
          }
        }

        await this.prisma.videoSource.update({
          where: { id: videoSourceId },
          data: { status: 'DELETED' },
        });
        this.logger.warn(
          `Synced videoSource ${videoSourceId}: ${provider} -> FAILED (marked DELETED)`,
        );

        const updatedJobs = await this.prisma.uploadJob.updateMany({
          where: { videoSourceId, status: 'PROCESSING' },
          data: { status: 'FAILED', errorMessage: 'Remote upload failed on provider side' },
        });
        if (updatedJobs.count > 0) {
          const jobs = await this.prisma.uploadJob.findMany({
            where: { videoSourceId, status: 'FAILED' },
            select: { id: true },
          });
          for (const job of jobs) {
            this.events.emitUploadStatus(job.id, 'FAILED');
          }
          this.logger.warn(
            `Marked ${updatedJobs.count} uploadJob(s) as FAILED for videoSource ${videoSourceId}`,
          );
        }
      }
    } catch (err) {
      this.logger.debug(
        `Sync skipped for ${videoSourceId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async syncEncodingFile(
    videoSourceId: string,
    provider: Provider,
    providerFileId: string,
  ): Promise<void> {
    try {
      const adapter = this.registry.get(provider);
      const apiKey = await this.accountService.resolveDecryptedApiKey(provider);
      const info = await adapter.getFileInfo(providerFileId, apiKey);

      if (info.status === 'READY') {
        await this.prisma.videoSource.update({
          where: { id: videoSourceId },
          data: { status: 'READY' },
        });
        this.logger.log(
          `Synced encoding videoSource ${videoSourceId}: ${provider} -> READY`,
        );

        const updatedJobs = await this.prisma.uploadJob.updateMany({
          where: { videoSourceId, status: 'PROCESSING' },
          data: { status: 'COMPLETED' },
        });
        if (updatedJobs.count > 0) {
          const jobs = await this.prisma.uploadJob.findMany({
            where: { videoSourceId, status: 'COMPLETED' },
            select: { id: true },
          });
          for (const job of jobs) {
            this.events.emitUploadStatus(job.id, 'COMPLETED');
          }
        }

        await this.fetchAndSaveThumbnail(
          videoSourceId,
          provider,
          providerFileId,
          apiKey,
        );
      } else if (info.status === 'ERROR' || info.status === 'DELETED') {
        await this.prisma.videoSource.update({
          where: { id: videoSourceId },
          data: { status: 'DELETED' },
        });
        this.logger.warn(
          `Synced encoding videoSource ${videoSourceId}: ${provider} -> ${info.status} (marked DELETED)`,
        );
      }
    } catch (err) {
      this.logger.debug(
        `Encoding sync skipped for ${videoSourceId}: ${err instanceof Error ? err.message : 'unknown'}`,
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
