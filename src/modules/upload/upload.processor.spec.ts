import { Provider, UploadSourceType } from '@prisma/client';
import { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadJobData } from '../../queue/queue.constants';
import { EventsGateway } from '../../websocket/events.gateway';
import { ProviderAccountService } from '../providers/provider-account.service';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../providers/provider-errors';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { UploadProcessor } from './upload.processor';

type MockedPrisma = {
  uploadJob: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  videoSource: {
    create: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('UploadProcessor', () => {
  let processor: UploadProcessor;
  let prisma: MockedPrisma;
  let registry: { get: ReturnType<typeof vi.fn> };
  let accountService: { resolveDecryptedApiKey: ReturnType<typeof vi.fn> };
  let events: { emitUploadStatus: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      uploadJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      videoSource: { create: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    };
    registry = { get: vi.fn() };
    accountService = { resolveDecryptedApiKey: vi.fn() };
    events = {
      emitUploadStatus: vi.fn(),
    };
    processor = new UploadProcessor(
      prisma as unknown as PrismaService,
      registry as unknown as ProviderRegistryService,
      accountService as unknown as ProviderAccountService,
      events as unknown as EventsGateway,
    );
  });

  function makeJob(data: UploadJobData, attemptsMade = 0): Job<UploadJobData> {
    return {
      data,
      id: 'bull-job-1',
      attemptsMade,
      attempts: 3,
    } as unknown as Job<UploadJobData>;
  }

  it('skips if upload job not found in DB', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue(null);

    await processor.process(makeJob({ uploadJobId: 'nonexistent' }));

    expect(prisma.uploadJob.update).not.toHaveBeenCalled();
  });

  it('skips if already completed', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
    });

    await processor.process(makeJob({ uploadJobId: 'job-1' }));

    expect(prisma.uploadJob.update).not.toHaveBeenCalled();
  });

  it('processes remote upload successfully', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.DOODSTREAM,
      sourceType: UploadSourceType.REMOTE_URL,
      sourceUrl: 'https://example.com/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
    registry.get.mockReturnValue({
      remoteUpload: vi.fn().mockResolvedValue({ trackingId: 'track-1' }),
    });
    prisma.videoSource.upsert.mockResolvedValue({ id: 'vs-1' });

    await processor.process(makeJob({ uploadJobId: 'job-1' }));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'PROCESSING',
        videoSourceId: 'vs-1',
      }),
    });
    expect(events.emitUploadStatus).toHaveBeenCalledWith('job-1', 'PROCESSING');
  });

  it('processes local upload successfully', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.MIXDROP,
      sourceType: UploadSourceType.LOCAL,
      sourceUrl: '/tmp/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
    registry.get.mockReturnValue({
      uploadFile: vi.fn().mockResolvedValue({
        providerFileId: 'file-abc',
        embedUrl: 'https://mixdrop.co/e/file-abc',
      }),
    });
    prisma.videoSource.upsert.mockResolvedValue({ id: 'vs-1' });

    await processor.process(makeJob({ uploadJobId: 'job-1' }));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(events.emitUploadStatus).toHaveBeenCalledWith('job-1', 'COMPLETED');
  });

  it('retries on ProviderRateLimitError when attempts left', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.DOODSTREAM,
      sourceType: UploadSourceType.REMOTE_URL,
      sourceUrl: 'https://example.com/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
    registry.get.mockReturnValue({
      remoteUpload: vi
        .fn()
        .mockRejectedValue(new ProviderRateLimitError('DOODSTREAM')),
    });

    await expect(
      processor.process(makeJob({ uploadJobId: 'job-1' }, 0)),
    ).rejects.toThrow(ProviderRateLimitError);

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'QUEUED', retryCount: 1 }),
    });
  });

  it('marks FAILED on non-retryable error', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.DOODSTREAM,
      sourceType: UploadSourceType.REMOTE_URL,
      sourceUrl: 'https://example.com/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
    registry.get.mockReturnValue({
      remoteUpload: vi
        .fn()
        .mockRejectedValue(new ProviderAuthError('DOODSTREAM')),
    });

    await processor.process(makeJob({ uploadJobId: 'job-1' }, 0));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
    expect(events.emitUploadStatus).toHaveBeenCalledWith('job-1', 'FAILED');
  });

  it('marks FAILED when retries exhausted on retryable error', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.DOODSTREAM,
      sourceType: UploadSourceType.REMOTE_URL,
      sourceUrl: 'https://example.com/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockResolvedValue('key-123');
    registry.get.mockReturnValue({
      remoteUpload: vi
        .fn()
        .mockRejectedValue(new ProviderUnavailableError('DOODSTREAM')),
    });

    await processor.process(makeJob({ uploadJobId: 'job-1' }, 2));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('throws ProviderAuthError when no active ProviderAccount', async () => {
    prisma.uploadJob.findUnique.mockResolvedValue({
      id: 'job-1',
      episodeId: 'ep-1',
      provider: Provider.STREAMTAPE,
      sourceType: UploadSourceType.REMOTE_URL,
      sourceUrl: 'https://example.com/video.mp4',
      status: 'QUEUED',
    });
    accountService.resolveDecryptedApiKey.mockRejectedValue(
      new ProviderAuthError('DOODSTREAM', 'No active account'),
    );

    await processor.process(makeJob({ uploadJobId: 'job-1' }, 0));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });
});
