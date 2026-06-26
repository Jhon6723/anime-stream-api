import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProviderAuthError,
  ProviderNotFoundError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../provider-errors';
import { DoodstreamAdapter } from './doodstream.adapter';

describe('DoodstreamAdapter', () => {
  let adapter: DoodstreamAdapter;
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
        if (key === 'providers.doodstream.baseUrl')
          return 'https://doodapi.com/api';
        return null;
      }),
    };
    adapter = new DoodstreamAdapter(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
  });

  describe('buildEmbedUrl', () => {
    it('builds correct embed URL', () => {
      expect(adapter.buildEmbedUrl('abc123')).toBe('https://dood.to/e/abc123');
    });
  });

  describe('remoteUpload', () => {
    it('returns tracking id on success', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { status: 200, result: { filecode: '98zukoh5jqiw' } },
        } as unknown as { data: unknown }),
      );

      const result = await adapter.remoteUpload(
        'https://example.com/video.mp4',
        'api-key',
      );

      expect(result.trackingId).toBe('98zukoh5jqiw');
    });

    it('throws ProviderUnavailableError on failed response', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { status: 400, result: null },
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
            status: 200,
            result: [
              {
                filecode: 'abc123',
                status: 'active',
                canplay: 1,
                views: '1500',
              },
            ],
          },
        } as unknown as { data: unknown }),
      );

      const info = await adapter.getFileInfo('abc123', 'api-key');

      expect(info.providerFileId).toBe('abc123');
      expect(info.status).toBe('READY');
      expect(info.views).toBe(1500);
    });

    it('throws ProviderNotFoundError when file not found', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { status: 404, result: [] },
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
          data: { status: 200 },
        } as unknown as { data: unknown }),
      );

      await expect(
        adapter.deleteFile('abc123', 'api-key'),
      ).resolves.toBeUndefined();
    });

    it('throws ProviderNotFoundError on failure', async () => {
      httpService.get.mockReturnValue(
        of({
          data: { status: 404 },
        } as unknown as { data: unknown }),
      );

      await expect(adapter.deleteFile('abc123', 'api-key')).rejects.toThrow(
        ProviderNotFoundError,
      );
    });
  });

  describe('error handling', () => {
    it('throws ProviderAuthError on 401', async () => {
      const error = { response: { status: 401 } };
      httpService.get.mockReturnValue(throwError(() => error));

      await expect(adapter.getFileInfo('abc', 'key')).rejects.toThrow(
        ProviderAuthError,
      );
    });

    it('throws ProviderRateLimitError on 429', async () => {
      const error = { response: { status: 429 } };
      httpService.get.mockReturnValue(throwError(() => error));

      await expect(adapter.getFileInfo('abc', 'key')).rejects.toThrow(
        ProviderRateLimitError,
      );
    });
  });
});
