import { Provider, UploadSourceType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../providers/provider-errors';
import { UploadProcessor } from './upload.processor';

describe('UploadProcessor', () => {
  let processor: UploadProcessor;
  let prisma: any;
  let registry: any;
  let accountService: any;
  let events: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      uploadJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      videoSource: { create: vi.fn(), upsert: vi.fn() },
    };
    registry = { get: vi.fn() };
    accountService = { resolveDecryptedApiKey: vi.fn() };
    events = {
      emitUploadStatus: vi.fn(),
    };
    processor = new UploadProcessor(prisma, registry, accountService, events);
  });

  function makeJob(data: any, attemptsMade = 0): any {
    return {
      data,
      id: 'bull-job-1',
      attemptsMade,
      attempts: 3,
    };
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
      data: expect.objectContaining({ status: 'PROCESSING', videoSourceId: 'vs-1' }),
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
      remoteUpload: vi.fn().mockRejectedValue(new ProviderRateLimitError('DOODSTREAM')),
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
      remoteUpload: vi.fn().mockRejectedValue(new ProviderAuthError('DOODSTREAM')),
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
      remoteUpload: vi.fn().mockRejectedValue(new ProviderUnavailableError('DOODSTREAM')),
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
    accountService.resolveDecryptedApiKey.mockRejectedValue(new ProviderAuthError('DOODSTREAM', 'No active account'));

    await processor.process(makeJob({ uploadJobId: 'job-1' }, 0));

    expect(prisma.uploadJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });
});
