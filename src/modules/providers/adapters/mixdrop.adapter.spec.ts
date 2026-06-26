import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProviderNotFoundError,
  ProviderUnavailableError,
} from '../provider-errors';
import { MixdropAdapter } from './mixdrop.adapter';

describe('MixdropAdapter', () => {
  let adapter: MixdropAdapter;
  let httpService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpService = {
      get: vi.fn(),
      post: vi.fn(),
    };
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'providers.mixdrop.baseUrl')
          return 'https://api.mixdrop.ag';
        if (key === 'providers.mixdrop.uploadBaseUrl')
          return 'https://ul.mixdrop.ag/api';
        if (key === 'providers.mixdrop.email') return 'test@test.com';
        return null;
      }),
    };
    adapter = new MixdropAdapter(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
  });

  describe('buildEmbedUrl', () => {
    it('builds correct embed URL', () => {
      expect(adapter.buildEmbedUrl('abc123')).toBe(
        'https://mixdrop.ag/e/abc123',
      );
    });
  });

  describe('remoteUpload', () => {
    it('returns tracking id on success', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { success: true, result: { id: 42 } },
        } as unknown as { data: unknown }),
      );

      const result = await adapter.remoteUpload(
        'https://example.com/video.mp4',
        'api-key',
      );

      expect(result.trackingId).toBe('42');
    });

    it('throws ProviderUnavailableError on failed response', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { success: false, result: null },
        } as unknown as { data: unknown }),
      );

      await expect(
        adapter.remoteUpload('https://example.com/video.mp4', 'api-key'),
      ).rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('getFileInfo', () => {
    it('returns mapped file info', async () => {
      httpService.get.mockReturnValue(
        of({
          data: {
            success: true,
            result: { fileref: 'ref123', status: 'finished', views: '500' },
          },
        } as unknown as { data: unknown }),
      );

      const info = await adapter.getFileInfo('ref123', 'api-key');

      expect(info.providerFileId).toBe('ref123');
      expect(info.status).toBe('READY');
    });

    it('throws ProviderNotFoundError when file not found', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { success: false, result: null },
        } as unknown as { data: unknown }),
      );

      await expect(
        adapter.getFileInfo('nonexistent', 'api-key'),
      ).rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('deleteFile', () => {
    it('completes on success', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { success: true },
        } as unknown as { data: unknown }),
      );

      await expect(
        adapter.deleteFile('ref123', 'api-key'),
      ).resolves.toBeUndefined();
    });

    it('throws ProviderNotFoundError on failure', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { success: false },
        } as unknown as { data: unknown }),
      );

      await expect(adapter.deleteFile('ref123', 'api-key')).rejects.toThrow(
        ProviderNotFoundError,
      );
    });
  });
});
