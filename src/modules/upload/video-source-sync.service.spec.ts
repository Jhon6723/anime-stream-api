import { Provider, VideoSourceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoSourceSyncService } from './video-source-sync.service';

describe('VideoSourceSyncService', () => {
  let service: VideoSourceSyncService;
  let prisma: any;
  let registry: any;
  let accountService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      videoSource: { update: vi.fn() },
    };
    registry = { get: vi.fn() };
    accountService = { resolveDecryptedApiKey: vi.fn() };
    service = new VideoSourceSyncService(prisma, registry, accountService);
  });

  describe('syncPendingSources', () => {
    it('does nothing when no sources are UPLOADING', async () => {
      const sources = [
        { id: 'vs-1', provider: Provider.STREAMTAPE, status: 'READY' as VideoSourceStatus, remoteTrackingId: 'track-1' },
      ];

      await service.syncPendingSources(sources);

      expect(registry.get).not.toHaveBeenCalled();
    });

    it('does nothing when sources have no remoteTrackingId', async () => {
      const sources = [
        { id: 'vs-1', provider: Provider.STREAMTAPE, status: 'UPLOADING' as VideoSourceStatus, remoteTrackingId: null },
      ];

      await service.syncPendingSources(sources);

      expect(registry.get).not.toHaveBeenCalled();
    });

    it('updates videoSource when remote upload is completed', async () => {
      const sources = [
        { id: 'vs-1', provider: Provider.STREAMTAPE, status: 'UPLOADING' as VideoSourceStatus, remoteTrackingId: 'track-1' },
      ];

      registry.get.mockReturnValue({
        checkRemoteUpload: vi.fn().mockResolvedValue({
          status: 'COMPLETED',
          providerFileId: 'file-abc',
          embedUrl: 'https://streamtape.com/e/file-abc',
        }),
      });
      accountService.resolveDecryptedApiKey.mockResolvedValue('api-key');
      prisma.videoSource.update.mockResolvedValue({});

      await service.syncPendingSources(sources);

      expect(prisma.videoSource.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: expect.objectContaining({
          providerFileId: 'file-abc',
          embedUrl: 'https://streamtape.com/e/file-abc',
          status: 'ENCODING',
        }),
      });
    });

    it('marks videoSource as ERROR when remote upload failed', async () => {
      const sources = [
        { id: 'vs-2', provider: Provider.MIXDROP, status: 'UPLOADING' as VideoSourceStatus, remoteTrackingId: 'track-2' },
      ];

      registry.get.mockReturnValue({
        checkRemoteUpload: vi.fn().mockResolvedValue({ status: 'FAILED' }),
      });
      accountService.resolveDecryptedApiKey.mockResolvedValue('api-key');
      prisma.videoSource.update.mockResolvedValue({});

      await service.syncPendingSources(sources);

      expect(prisma.videoSource.update).toHaveBeenCalledWith({
        where: { id: 'vs-2' },
        data: { status: 'ERROR' },
      });
    });

    it('does not update when remote upload is still pending', async () => {
      const sources = [
        { id: 'vs-3', provider: Provider.DOODSTREAM, status: 'UPLOADING' as VideoSourceStatus, remoteTrackingId: 'track-3' },
      ];

      registry.get.mockReturnValue({
        checkRemoteUpload: vi.fn().mockResolvedValue({ status: 'PENDING' }),
      });
      accountService.resolveDecryptedApiKey.mockResolvedValue('api-key');

      await service.syncPendingSources(sources);

      expect(prisma.videoSource.update).not.toHaveBeenCalled();
    });

    it('handles errors gracefully without throwing', async () => {
      const sources = [
        { id: 'vs-4', provider: Provider.STREAMTAPE, status: 'UPLOADING' as VideoSourceStatus, remoteTrackingId: 'track-4' },
      ];

      registry.get.mockImplementation(() => {
        throw new Error('No adapter');
      });

      await expect(service.syncPendingSources(sources)).resolves.not.toThrow();
    });
  });
});
