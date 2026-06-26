import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Provider, UploadSourceType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UPLOAD_QUEUE, UploadJobData } from '../../queue/queue.constants';
import { ProviderAccountService } from '../providers/provider-account.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { VideoSourceSyncService } from './video-source-sync.service';

export interface CsvUploadResult {
  enqueued: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class UploadService {
  constructor(
    @InjectQueue(UPLOAD_QUEUE)
    private readonly uploadQueue: Queue<UploadJobData>,
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly accountService: ProviderAccountService,
    private readonly syncService: VideoSourceSyncService,
  ) {}

  async createUpload(dto: CreateUploadDto, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: dto.episodeId },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${dto.episodeId} not found`);
    }

    if (dto.sourceType === UploadSourceType.REMOTE_URL && !dto.sourceUrl) {
      throw new BadRequestException(
        'sourceUrl is required for REMOTE_URL uploads',
      );
    }

    await this.checkDuplicate(dto.episodeId, dto.provider, dto.sourceUrl);

    const job = await this.prisma.uploadJob.create({
      data: {
        episodeId: dto.episodeId,
        provider: dto.provider,
        sourceType: dto.sourceType,
        sourceUrl: dto.sourceUrl,
        status: 'QUEUED',
        initiatedById: userId,
      },
    });

    await this.enqueue(job.id);
    return job;
  }

  async createBulkUpload(dto: BulkUploadDto, userId: string) {
    const results: { uploadJobId: string; episodeId: string }[] = [];

    for (const item of dto.items) {
      const episode = await this.prisma.episode.findUnique({
        where: { id: item.episodeId },
      });
      if (!episode) {
        continue;
      }

      const hasDuplicate = await this.prisma.videoSource.findFirst({
        where: {
          episodeId: item.episodeId,
          provider: dto.provider,
          status: { not: 'DELETED' },
        },
      });
      if (hasDuplicate) {
        continue;
      }

      const job = await this.prisma.uploadJob.create({
        data: {
          episodeId: item.episodeId,
          provider: dto.provider,
          sourceType: UploadSourceType.REMOTE_URL,
          sourceUrl: item.url,
          status: 'QUEUED',
          initiatedById: userId,
        },
      });

      await this.enqueue(job.id);
      results.push({ uploadJobId: job.id, episodeId: item.episodeId });
    }

    return { enqueued: results.length, jobs: results };
  }

  async createCsvUpload(
    csvContent: string,
    provider: Provider,
    userId: string,
  ): Promise<CsvUploadResult> {
    const { parse } = await import('csv-parse/sync');
    const errors: { row: number; message: string }[] = [];
    let enqueued = 0;

    let records: Record<string, string>[] = [];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      throw new BadRequestException('Invalid CSV format');
    }

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      const animeSlug = row.anime_slug?.trim();
      const episodeNumber = row.episode_number?.trim();
      const url = row.url?.trim();

      if (!animeSlug || !episodeNumber || !url) {
        errors.push({
          row: rowNum,
          message: 'Missing required fields (anime_slug, episode_number, url)',
        });
        continue;
      }

      const anime = await this.prisma.anime.findUnique({
        where: { slug: animeSlug },
        include: {
          episodes: { where: { episodeNumber: parseInt(episodeNumber, 10) } },
        },
      });

      if (!anime || anime.episodes.length === 0) {
        errors.push({
          row: rowNum,
          message: `Anime/episode not found: ${animeSlug} ep ${episodeNumber}`,
        });
        continue;
      }

      const episode = anime.episodes[0];

      const hasDuplicate = await this.prisma.videoSource.findFirst({
        where: {
          episodeId: episode.id,
          provider,
          status: { not: 'DELETED' },
        },
      });
      if (hasDuplicate) {
        errors.push({
          row: rowNum,
          message: `Duplicate: ${animeSlug} ep ${episodeNumber} already has active ${provider} source`,
        });
        continue;
      }

      const job = await this.prisma.uploadJob.create({
        data: {
          episodeId: episode.id,
          provider,
          sourceType: UploadSourceType.REMOTE_URL,
          sourceUrl: url,
          status: 'QUEUED',
          initiatedById: userId,
        },
      });

      await this.enqueue(job.id);
      enqueued++;
    }

    return { enqueued, errors };
  }

  async listJobs(userId?: string) {
    const jobs = await this.prisma.uploadJob.findMany({
      where: userId ? { initiatedById: userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        episode: {
          select: {
            id: true,
            episodeNumber: true,
            anime: { select: { title: true, slug: true } },
          },
        },
        videoSource: {
          select: {
            id: true,
            provider: true,
            status: true,
            embedUrl: true,
            remoteTrackingId: true,
          },
        },
      },
    });

    const sourcesToSync = jobs
      .map((j) => j.videoSource)
      .filter((vs): vs is NonNullable<typeof vs> => vs !== null);

    if (sourcesToSync.length > 0) {
      await this.syncService.syncPendingSources(sourcesToSync);

      return this.prisma.uploadJob.findMany({
        where: userId ? { initiatedById: userId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          episode: {
            select: {
              id: true,
              episodeNumber: true,
              anime: { select: { title: true, slug: true } },
            },
          },
          videoSource: {
            select: { id: true, provider: true, status: true, embedUrl: true },
          },
        },
      });
    }

    return jobs;
  }

  async getJob(jobId: string, userId?: string) {
    return this.prisma.uploadJob.findFirst({
      where: { id: jobId, ...(userId ? { initiatedById: userId } : {}) },
      include: {
        episode: {
          select: {
            id: true,
            episodeNumber: true,
            anime: { select: { title: true, slug: true } },
          },
        },
        videoSource: {
          select: {
            id: true,
            provider: true,
            status: true,
            embedUrl: true,
            remoteTrackingId: true,
          },
        },
      },
    });
  }

  async enqueue(uploadJobId: string): Promise<void> {
    await this.uploadQueue.add(
      'process-upload',
      { uploadJobId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
      },
    );
  }

  private async checkDuplicate(
    episodeId: string,
    provider: Provider,
    sourceUrl?: string,
  ): Promise<void> {
    const existing = await this.prisma.videoSource.findFirst({
      where: { episodeId, provider, status: { not: 'DELETED' } },
    });
    if (existing) {
      throw new BadRequestException(
        `Duplicate: episode ${episodeId} already has an active ${provider} source`,
      );
    }

    if (sourceUrl) {
      const pendingJob = await this.prisma.uploadJob.findFirst({
        where: {
          sourceUrl,
          provider,
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
      });
      if (pendingJob) {
        throw new BadRequestException(
          `Duplicate: a pending upload job already exists for this source URL`,
        );
      }
    }
  }

  private async resolveApiKey(provider: Provider): Promise<string> {
    return this.accountService.resolveDecryptedApiKey(provider);
  }

  async presignUpload(dto: PresignUploadDto) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: dto.episodeId },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${dto.episodeId} not found`);
    }

    await this.checkDuplicate(dto.episodeId, dto.provider);

    const adapter = this.registry.get(dto.provider);
    if (!adapter.getUploadUrl) {
      throw new BadRequestException(
        `Provider ${dto.provider} does not support direct upload (presign). Use REMOTE_URL instead.`,
      );
    }

    const apiKey = await this.resolveApiKey(dto.provider);
    const presign = await adapter.getUploadUrl(apiKey);

    if (presign.requiresServerProxy) {
      throw new BadRequestException(
        `Provider ${dto.provider} requires server-side proxy upload. Use POST /uploads/stream instead.`,
      );
    }

    return {
      uploadUrl: presign.uploadUrl,
      extraFields: presign.extraFields,
      provider: dto.provider,
      episodeId: dto.episodeId,
    };
  }

  async streamUpload(
    fileBuffer: Buffer,
    fileName: string,
    episodeId: string,
    provider: Provider,
    userId: string,
  ) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }

    await this.checkDuplicate(episodeId, provider);

    const adapter = this.registry.get(provider);
    if (!adapter.streamUpload) {
      throw new BadRequestException(
        `Provider ${provider} does not support stream upload. Use REMOTE_URL instead.`,
      );
    }

    const apiKey = await this.resolveApiKey(provider);
    const result = await adapter.streamUpload(fileBuffer, fileName, apiKey);

    const videoSource = await this.prisma.videoSource.create({
      data: {
        episodeId,
        provider,
        providerFileId: result.providerFileId,
        embedUrl: result.embedUrl,
        downloadUrl: result.downloadUrl,
        status: 'ENCODING',
      },
    });

    const job = await this.prisma.uploadJob.create({
      data: {
        episodeId,
        provider,
        sourceType: UploadSourceType.LOCAL,
        status: 'COMPLETED',
        videoSourceId: videoSource.id,
        initiatedById: userId,
      },
    });

    return { uploadJob: job, videoSource };
  }

  async confirmUpload(dto: ConfirmUploadDto, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: dto.episodeId },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${dto.episodeId} not found`);
    }

    await this.checkDuplicate(dto.episodeId, dto.provider);

    const adapter = this.registry.get(dto.provider);
    if (!adapter.getUploadUrl) {
      throw new BadRequestException(
        `Provider ${dto.provider} does not support presign upload. Use POST /uploads/stream instead.`,
      );
    }

    const videoSource = await this.prisma.videoSource.create({
      data: {
        episodeId: dto.episodeId,
        provider: dto.provider,
        providerFileId: dto.providerFileId,
        embedUrl: dto.embedUrl,
        downloadUrl: dto.downloadUrl,
        status: 'ENCODING',
      },
    });

    const job = await this.prisma.uploadJob.create({
      data: {
        episodeId: dto.episodeId,
        provider: dto.provider,
        sourceType: UploadSourceType.LOCAL,
        status: 'COMPLETED',
        videoSourceId: videoSource.id,
        initiatedById: userId,
      },
    });

    return { uploadJob: job, videoSource };
  }
}
