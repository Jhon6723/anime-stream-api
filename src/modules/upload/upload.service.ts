import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Provider, SubtitleLanguage, UploadSourceType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UPLOAD_QUEUE, UploadJobData } from '../../queue/queue.constants';
import { ProviderAccountService } from '../providers/provider-account.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
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

    await this.checkDuplicate(
      dto.episodeId,
      dto.provider,
      dto.language,
      dto.sourceUrl,
    );

    const job = await this.prisma.uploadJob.create({
      data: {
        episodeId: dto.episodeId,
        provider: dto.provider,
        language: dto.language,
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
          language: item.language ?? dto.language,
          status: { notIn: ['DELETED', 'ERROR'] },
        },
      });
      if (hasDuplicate) {
        continue;
      }

      const job = await this.prisma.uploadJob.create({
        data: {
          episodeId: item.episodeId,
          provider: dto.provider,
          language: item.language ?? dto.language,
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
    language: SubtitleLanguage,
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
          language,
          status: { notIn: ['DELETED', 'ERROR'] },
        },
      });
      if (hasDuplicate) {
        errors.push({
          row: rowNum,
          message: `Duplicate: ${animeSlug} ep ${episodeNumber} already has active ${provider} (${language}) source`,
        });
        continue;
      }

      const job = await this.prisma.uploadJob.create({
        data: {
          episodeId: episode.id,
          provider,
          language,
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
            language: true,
            status: true,
            embedUrl: true,
            remoteTrackingId: true,
            providerFileId: true,
          },
        },
      },
    });

    const sourcesToSync = jobs
      .map((j) => j.videoSource)
      .filter((vs): vs is NonNullable<typeof vs> => vs !== null);

    if (sourcesToSync.length > 0) {
      await this.syncService.syncPendingSources(sourcesToSync);
    }

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
          select: {
            id: true,
            provider: true,
            language: true,
            status: true,
            embedUrl: true,
          },
        },
      },
    });
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
            language: true,
            status: true,
            embedUrl: true,
            remoteTrackingId: true,
            providerFileId: true,
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
    language: SubtitleLanguage,
    sourceUrl?: string,
  ): Promise<void> {
    const existing = await this.prisma.videoSource.findFirst({
      where: { episodeId, provider, language, status: { notIn: ['DELETED', 'ERROR'] } },
    });
    if (existing) {
      throw new BadRequestException(
        `Duplicate: episode ${episodeId} already has an active ${provider} (${language}) source`,
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

  async streamUpload(
    fileBuffer: Buffer,
    fileName: string,
    episodeId: string,
    provider: Provider,
    language: SubtitleLanguage,
    userId: string,
  ) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }

    await this.checkDuplicate(episodeId, provider, language);

    const adapter = this.registry.get(provider);
    if (!adapter.streamUpload) {
      throw new BadRequestException(
        `Provider ${provider} does not support stream upload. Use REMOTE_URL instead.`,
      );
    }

    const apiKey = await this.resolveApiKey(provider);
    const result = await adapter.streamUpload(fileBuffer, fileName, apiKey);

    const videoSource = await this.prisma.videoSource.upsert({
      where: {
        episodeId_provider_language: {
          episodeId,
          provider,
          language,
        },
      },
      create: {
        episodeId,
        provider,
        language,
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
        remoteTrackingId: null,
      },
    });

    const job = await this.prisma.uploadJob.create({
      data: {
        episodeId,
        provider,
        language,
        sourceType: UploadSourceType.LOCAL,
        status: 'COMPLETED',
        videoSourceId: videoSource.id,
        initiatedById: userId,
      },
    });

    return { uploadJob: job, videoSource };
  }
}
