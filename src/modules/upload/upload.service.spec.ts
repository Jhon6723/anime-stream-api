import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Provider, UploadSourceType } from '@prisma/client';
import { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadJobData } from '../../queue/queue.constants';
import { ProviderAccountService } from '../providers/provider-account.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UploadService } from './upload.service';
import { VideoSourceSyncService } from './video-source-sync.service';

type MockedQueue = Pick<Queue<UploadJobData>, 'add'>;
type MockedPrisma = {
  episode: { findUnique: ReturnType<typeof vi.fn> };
  anime: { findUnique: ReturnType<typeof vi.fn> };
  videoSource: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  uploadJob: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

describe('UploadService', () => {
  let service: UploadService;
  let prisma: MockedPrisma;
  let uploadQueue: MockedQueue;
  let registry: { get: ReturnType<typeof vi.fn> };
  let accountService: { resolveDecryptedApiKey: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      episode: { findUnique: vi.fn() },
      anime: { findUnique: vi.fn() },
      videoSource: { findFirst: vi.fn(), create: vi.fn() },
      uploadJob: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    };
    uploadQueue = { add: vi.fn() };
    registry = { get: vi.fn() };
    accountService = { resolveDecryptedApiKey: vi.fn() };
    service = new UploadService(
      uploadQueue as unknown as Queue<UploadJobData>,
      prisma as unknown as PrismaService,
      registry as unknown as ProviderRegistryService,
      accountService as unknown as ProviderAccountService,
      { syncPendingSources: vi.fn() } as unknown as VideoSourceSyncService,
    );
  });

  describe('createUpload', () => {
    it('creates and enqueues a job for valid remote upload', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      prisma.uploadJob.findFirst.mockResolvedValue(null);
      prisma.uploadJob.create.mockResolvedValue({ id: 'job-1' });

      const dto: CreateUploadDto = {
        episodeId: 'ep-1',
        provider: Provider.DOODSTREAM,
        sourceType: UploadSourceType.REMOTE_URL,
        sourceUrl: 'https://example.com/video.mp4',
      };

      const result = await service.createUpload(dto, 'user-1');

      expect(result.id).toBe('job-1');
      expect(prisma.uploadJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          episodeId: 'ep-1',
          provider: Provider.DOODSTREAM,
          sourceType: UploadSourceType.REMOTE_URL,
          sourceUrl: 'https://example.com/video.mp4',
          status: 'QUEUED',
          initiatedById: 'user-1',
        }),
      });
      expect(uploadQueue.add).toHaveBeenCalledWith(
        'process-upload',
        { uploadJobId: 'job-1' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
    });

    it('throws NotFoundException when episode does not exist', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      const dto: CreateUploadDto = {
        episodeId: 'nonexistent',
        provider: Provider.DOODSTREAM,
        sourceType: UploadSourceType.REMOTE_URL,
        sourceUrl: 'https://example.com/video.mp4',
      };

      await expect(service.createUpload(dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when REMOTE_URL has no sourceUrl', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });

      const dto: CreateUploadDto = {
        episodeId: 'ep-1',
        provider: Provider.DOODSTREAM,
        sourceType: UploadSourceType.REMOTE_URL,
      };

      await expect(service.createUpload(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on duplicate', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'vs-1' });

      const dto: CreateUploadDto = {
        episodeId: 'ep-1',
        provider: Provider.DOODSTREAM,
        sourceType: UploadSourceType.REMOTE_URL,
        sourceUrl: 'https://example.com/video.mp4',
      };

      await expect(service.createUpload(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when a pending job with same sourceUrl exists', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      prisma.uploadJob.findFirst.mockResolvedValue({ id: 'job-existing' });

      const dto: CreateUploadDto = {
        episodeId: 'ep-1',
        provider: Provider.DOODSTREAM,
        sourceType: UploadSourceType.REMOTE_URL,
        sourceUrl: 'https://example.com/video.mp4',
      };

      await expect(service.createUpload(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createBulkUpload', () => {
    it('creates jobs for valid items and skips duplicates', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'vs-1' });
      prisma.uploadJob.create.mockResolvedValue({ id: 'job-1' });

      const dto: BulkUploadDto = {
        provider: Provider.MIXDROP,
        items: [
          { episodeId: 'ep-1', url: 'https://example.com/1.mp4' },
          { episodeId: 'ep-1', url: 'https://example.com/2.mp4' },
        ],
      };

      const result = await service.createBulkUpload(dto, 'user-1');

      expect(result.enqueued).toBe(1);
      expect(result.jobs).toHaveLength(1);
    });

    it('skips items when episode not found', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      const dto: BulkUploadDto = {
        provider: Provider.STREAMTAPE,
        items: [{ episodeId: 'nonexistent', url: 'https://example.com/1.mp4' }],
      };

      const result = await service.createBulkUpload(dto, 'user-1');

      expect(result.enqueued).toBe(0);
    });
  });

  describe('createCsvUpload', () => {
    it('parses valid CSV and enqueues jobs', async () => {
      const csv =
        'anime_slug,episode_number,url\nnaruto,1,https://example.com/ep1.mp4\nnaruto,2,https://example.com/ep2.mp4';

      prisma.anime.findUnique.mockResolvedValue({
        id: 'anime-1',
        episodes: [{ id: 'ep-1' }],
      });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      prisma.uploadJob.create.mockResolvedValue({ id: 'job-1' });

      const result = await service.createCsvUpload(
        csv,
        Provider.DOODSTREAM,
        'user-1',
      );

      expect(result.enqueued).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('reports errors for missing fields', async () => {
      const csv =
        'anime_slug,episode_number,url\n,,https://example.com/ep1.mp4';

      const result = await service.createCsvUpload(
        csv,
        Provider.DOODSTREAM,
        'user-1',
      );

      expect(result.enqueued).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
    });

    it('reports errors for non-existent anime/episode', async () => {
      const csv =
        'anime_slug,episode_number,url\nunknown,99,https://example.com/ep1.mp4';

      prisma.anime.findUnique.mockResolvedValue({ id: 'a-1', episodes: [] });

      const result = await service.createCsvUpload(
        csv,
        Provider.DOODSTREAM,
        'user-1',
      );

      expect(result.enqueued).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('listJobs', () => {
    it('returns jobs for all when no userId', async () => {
      prisma.uploadJob.findMany.mockResolvedValue([{ id: 'job-1' }]);

      const result = await service.listJobs();

      expect(result).toHaveLength(1);
      expect(prisma.uploadJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('filters by userId when provided', async () => {
      prisma.uploadJob.findMany.mockResolvedValue([{ id: 'job-1' }]);

      const result = await service.listJobs('user-1');

      expect(result).toHaveLength(1);
      expect(prisma.uploadJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { initiatedById: 'user-1' } }),
      );
    });
  });

  describe('presignUpload', () => {
    it('returns presign URL for supported provider', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
      registry.get.mockReturnValue({
        getUploadUrl: vi.fn().mockResolvedValue({
          uploadUrl: 'https://upload.doodapi.com/abc',
          extraFields: { api_key: 'key-123' },
        }),
      });

      const result = await service.presignUpload({
        episodeId: 'ep-1',
        provider: Provider.DOODSTREAM,
      });

      expect(result.uploadUrl).toBe('https://upload.doodapi.com/abc');
      expect(result.extraFields).toEqual({ api_key: 'key-123' });
    });

    it('throws BadRequestException when provider does not support presign', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      registry.get.mockReturnValue({});

      await expect(
        service.presignUpload({
          episodeId: 'ep-1',
          provider: Provider.MIXDROP,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on duplicate', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'vs-1' });

      await expect(
        service.presignUpload({
          episodeId: 'ep-1',
          provider: Provider.DOODSTREAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmUpload', () => {
    it('creates VideoSource and UploadJob on confirm', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      prisma.videoSource.create.mockResolvedValue({ id: 'vs-1' });
      prisma.uploadJob.create.mockResolvedValue({ id: 'job-1' });
      registry.get.mockReturnValue({ getUploadUrl: vi.fn() });

      const result = await service.confirmUpload(
        {
          episodeId: 'ep-1',
          provider: Provider.STREAMTAPE,
          providerFileId: 'file-abc',
          embedUrl: 'https://streamtape.com/e/file-abc',
        },
        'user-1',
      );

      expect(result.videoSource.id).toBe('vs-1');
      expect(result.uploadJob.id).toBe('job-1');
      expect(prisma.videoSource.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          episodeId: 'ep-1',
          provider: Provider.STREAMTAPE,
          providerFileId: 'file-abc',
          status: 'ENCODING',
        }),
      });
    });

    it('throws BadRequestException on duplicate', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue({ id: 'vs-1' });
      registry.get.mockReturnValue({ getUploadUrl: vi.fn() });

      await expect(
        service.confirmUpload(
          {
            episodeId: 'ep-1',
            provider: Provider.STREAMTAPE,
            providerFileId: 'file-abc',
            embedUrl: 'https://streamtape.com/e/file-abc',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for provider without presign support', async () => {
      prisma.episode.findUnique.mockResolvedValue({ id: 'ep-1' });
      prisma.videoSource.findFirst.mockResolvedValue(null);
      registry.get.mockReturnValue({ getUploadUrl: undefined });

      await expect(
        service.confirmUpload(
          {
            episodeId: 'ep-1',
            provider: Provider.DOODSTREAM,
            providerFileId: 'file-abc',
            embedUrl: 'https://dood.to/e/file-abc',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
