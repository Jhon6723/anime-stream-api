import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ProviderNotFoundError,
    ProviderUnavailableError,
} from '../provider-errors';
import { StreamtapeAdapter } from './streamtape.adapter';

describe('StreamtapeAdapter', () => {
  let adapter: StreamtapeAdapter;
  let httpService: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpService = {
      get: vi.fn(),
      post: vi.fn(),
    };
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'providers.streamtape.baseUrl') return 'https://api.streamtape.com';
        if (key === 'providers.streamtape.login') return 'testlogin';
        return null;
      }),
    };
    adapter = new StreamtapeAdapter(
      httpService as any,
      configService as unknown as ConfigService,
    );
  });

  describe('buildEmbedUrl', () => {
    it('builds correct embed URL', () => {
      expect(adapter.buildEmbedUrl('abc123')).toBe('https://streamtape.com/e/abc123');
    });
  });

  describe('remoteUpload', () => {
    it('returns tracking id on success', async () => {
      httpService.get.mockReturnValue(of({
        data: { status: 200, result: { id: 'track-456' } },
      } as AxiosResponse));

      const result = await adapter.remoteUpload('https://example.com/video.mp4', 'api-key');

      expect(result.trackingId).toBe('track-456');
    });

    it('throws ProviderUnavailableError on failed response', async () => {
      httpService.get.mockReturnValue(of({
        data: { status: 400, result: null },
      } as AxiosResponse));

      await expect(adapter.remoteUpload('https://example.com/video.mp4', 'api-key'))
        .rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('getFileInfo', () => {
    it('returns mapped file info', async () => {
      httpService.get.mockReturnValue(of({
        data: {
          status: 200,
          result: { 'file123': { id: 'file123', name: 'video.mp4', converted: true, status: 200 } },
        },
      } as AxiosResponse));

      const info = await adapter.getFileInfo('file123', 'api-key');

      expect(info.providerFileId).toBe('file123');
      expect(info.status).toBe('READY');
    });

    it('throws ProviderNotFoundError when file not found', async () => {
      httpService.get.mockReturnValue(of({
        data: { status: 404, result: [] },
      } as AxiosResponse));

      await expect(adapter.getFileInfo('nonexistent', 'api-key'))
        .rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('deleteFile', () => {
    it('completes on success', async () => {
      httpService.get.mockReturnValue(of({
        data: { status: 200 },
      } as AxiosResponse));

      await expect(adapter.deleteFile('file123', 'api-key')).resolves.toBeUndefined();
    });

    it('throws ProviderNotFoundError on failure', async () => {
      httpService.get.mockReturnValue(of({
        data: { status: 404 },
      } as AxiosResponse));

      await expect(adapter.deleteFile('file123', 'api-key'))
        .rejects.toThrow(ProviderNotFoundError);
    });
  });
});
