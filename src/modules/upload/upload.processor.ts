import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Provider, UploadSourceType } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UPLOAD_QUEUE, UploadJobData } from '../../queue/queue.constants';
import { EventsGateway } from '../../websocket/events.gateway';
import { ProviderAccountService } from '../providers/provider-account.service';
import {
    ProviderRateLimitError,
    ProviderUnavailableError,
} from '../providers/provider-errors';
import { ProviderRegistryService } from '../providers/provider-registry.service';

const MAX_RETRIES = 3;

@Processor(UPLOAD_QUEUE)
export class UploadProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly accountService: ProviderAccountService,
    private readonly events: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<UploadJobData>): Promise<void> {
    const { uploadJobId } = job.data;
    this.logger.log(`Processing upload job ${uploadJobId} (attempt ${job.attemptsMade + 1})`);

    const uploadJob = await this.prisma.uploadJob.findUnique({
      where: { id: uploadJobId },
    });

    if (!uploadJob) {
      this.logger.warn(`UploadJob ${uploadJobId} not found in DB`);
      return;
    }

    if (uploadJob.status === 'COMPLETED') {
      this.logger.log(`UploadJob ${uploadJobId} already completed, skipping`);
      return;
    }

    await this.prisma.uploadJob.update({
      where: { id: uploadJobId },
      data: { status: 'UPLOADING', retryCount: job.attemptsMade },
    });

    this.events.emitUploadStatus(uploadJobId, 'UPLOADING');

    try {
      const adapter = this.registry.get(uploadJob.provider);
      const apiKey = await this.resolveApiKey(uploadJob.provider);

      let result;

      if (uploadJob.sourceType === UploadSourceType.REMOTE_URL) {
        const remoteResult = await adapter.remoteUpload(uploadJob.sourceUrl!, apiKey);
        this.logger.log(`Remote upload enqueued for job ${uploadJobId}, tracking: ${remoteResult.trackingId}`);

        const videoSource = await this.prisma.videoSource.upsert({
          where: {
            episodeId_provider: {
              episodeId: uploadJob.episodeId,
              provider: uploadJob.provider,
            },
          },
          create: {
            episodeId: uploadJob.episodeId,
            provider: uploadJob.provider,
            status: 'UPLOADING',
            remoteTrackingId: remoteResult.trackingId,
          },
          update: {
            status: 'UPLOADING',
            remoteTrackingId: remoteResult.trackingId,
          },
        });

        await this.prisma.uploadJob.update({
          where: { id: uploadJobId },
          data: {
            status: 'PROCESSING',
            videoSourceId: videoSource.id,
          },
        });

        this.events.emitUploadStatus(uploadJobId, 'PROCESSING');
      } else {
        result = await adapter.uploadFile(uploadJob.sourceUrl!, apiKey);

        const videoSource = await this.prisma.videoSource.upsert({
          where: {
            episodeId_provider: {
              episodeId: uploadJob.episodeId,
              provider: uploadJob.provider,
            },
          },
          create: {
            episodeId: uploadJob.episodeId,
            provider: uploadJob.provider,
            providerFileId: result.providerFileId,
            embedUrl: result.embedUrl,
            downloadUrl: result.downloadUrl,
            status: 'ENCODING',
          },
          update: {
            providerFileId: result.providerFileId,
            embedUrl: result.embedUrl,
            downloadUrl: result.downloadUrl,
            status: 'ENCODING',
          },
        });

        await this.prisma.uploadJob.update({
          where: { id: uploadJobId },
          data: {
            status: 'COMPLETED',
            videoSourceId: videoSource.id,
          },
        });

        this.events.emitUploadStatus(uploadJobId, 'COMPLETED');
      }
    } catch (err) {
      const isRetryable = err instanceof ProviderRateLimitError ||
        err instanceof ProviderUnavailableError;
      const attemptsLeft = MAX_RETRIES - job.attemptsMade - 1;

      if (isRetryable && attemptsLeft > 0) {
        this.logger.warn(
          `UploadJob ${uploadJobId} failed (retryable), ${attemptsLeft} attempts left: ${err.message}`,
        );
        await this.prisma.uploadJob.update({
          where: { id: uploadJobId },
          data: { status: 'QUEUED', retryCount: job.attemptsMade + 1 },
        });
        this.events.emitUploadStatus(uploadJobId, 'QUEUED');
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`UploadJob ${uploadJobId} failed permanently: ${errorMessage}`);

      await this.prisma.uploadJob.update({
        where: { id: uploadJobId },
        data: { status: 'FAILED', errorMessage },
      });

      this.events.emitUploadStatus(uploadJobId, 'FAILED');
    }
  }

  private async resolveApiKey(provider: Provider): Promise<string> {
    return this.accountService.resolveDecryptedApiKey(provider);
  }
}
