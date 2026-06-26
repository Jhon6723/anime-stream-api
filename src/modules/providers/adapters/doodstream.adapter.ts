import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import {
    ProviderAuthError,
    ProviderNotFoundError,
    ProviderRateLimitError,
    ProviderUnavailableError,
} from '../provider-errors';
import {
    PresignResult,
    ProviderAccountInfo,
    ProviderFileInfo,
    RemoteUploadResult,
    RemoteUploadStatus,
    UploadResult,
    VideoProvider
} from '../video-provider.interface';

/**
 * Adapter DoodStream. Ver spec 004-upload-doodstream.
 * API docs: https://doodapi.com/api
 */
@Injectable()
export class DoodstreamAdapter implements VideoProvider {
  private readonly logger = new Logger(DoodstreamAdapter.name);
  readonly provider = Provider.DOODSTREAM;
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('providers.doodstream.baseUrl')!;
  }

  async uploadFile(filePath: string, apiKey: string): Promise<UploadResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/upload/server`, {
          params: { key: apiKey },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Failed to get upload server');
      }

      const uploadUrl = data.result;

      const FormData = require('form-data');
      const fs = require('fs');
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('file', fs.createReadStream(filePath));

      const uploadRes = await firstValueFrom(
        this.http.post(uploadUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (uploadRes.data.status !== 200 || !uploadRes.data.result?.[0]) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Upload failed');
      }

      const file = uploadRes.data.result[0];
      const providerFileId = file.filecode;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
        downloadUrl: file.download_url,
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async getUploadUrl(apiKey: string): Promise<PresignResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/upload/server`, {
          params: { key: apiKey },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Failed to get upload server');
      }

      return {
        uploadUrl: data.result,
        extraFields: { api_key: apiKey },
        requiresServerProxy: true,
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async streamUpload(fileBuffer: Buffer, fileName: string, apiKey: string): Promise<UploadResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/upload/server`, {
          params: { key: apiKey },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Failed to get upload server');
      }

      const uploadUrl = data.result;

      const FormData = require('form-data');
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('file', fileBuffer, fileName);

      const uploadRes = await firstValueFrom(
        this.http.post(uploadUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (uploadRes.data.status !== 200 || !uploadRes.data.result?.[0]) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Upload failed');
      }

      const file = uploadRes.data.result[0];
      const providerFileId = file.filecode;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
        downloadUrl: file.download_url,
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/upload/url`, {
          params: { key: apiKey, url },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError('DOODSTREAM', 'Remote upload failed');
      }

      return { trackingId: data.result.filecode ?? String(data.result) };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async checkRemoteUpload(trackingId: string, apiKey: string): Promise<RemoteUploadStatus> {
    try {
      const info = await this.getFileInfo(trackingId, apiKey);
      return {
        status: info.status === 'READY' || info.status === 'ENCODING' ? 'COMPLETED' : 'PENDING',
        providerFileId: info.providerFileId,
        embedUrl: this.buildEmbedUrl(info.providerFileId),
      };
    } catch {
      return { status: 'PENDING' };
    }
  }

  async getFileInfo(providerFileId: string, apiKey: string): Promise<ProviderFileInfo> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/file/info`, {
          params: { key: apiKey, file_code: providerFileId },
        }),
      );

      if (data.status !== 200 || !data.result?.[0]) {
        throw new ProviderNotFoundError('DOODSTREAM', `File ${providerFileId} not found`);
      }

      const file = data.result[0];
      const canplay = parseInt(file.canplay ?? '0', 10);
      return {
        providerFileId: file.filecode,
        status: canplay === 1 ? 'READY' : 'ENCODING',
        views: parseInt(file.views ?? '0', 10),
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async deleteFile(providerFileId: string, apiKey: string): Promise<void> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/file/delete`, {
          params: { key: apiKey, file_code: providerFileId },
        }),
      );

      if (data.status !== 200) {
        throw new ProviderNotFoundError('DOODSTREAM', `File ${providerFileId} not found or already deleted`);
      }
    } catch (err) {
      throw this.handleError(err);
    }
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://dood.to/e/${providerFileId}`;
  }

  async getAccountInfo(apiKey: string): Promise<ProviderAccountInfo> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/account/info`, {
          params: { key: apiKey },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderAuthError('DOODSTREAM', 'Failed to get account info');
      }

      return {
        balance: parseFloat(data.result.balance ?? '0'),
        email: data.result.email,
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  private mapStatus(status: string | number): ProviderFileInfo['status'] {
    const s = typeof status === 'string' ? status.toUpperCase() : '';
    switch (s) {
      case 'CONVERTING':
      case 'ENCODING':
        return 'ENCODING';
      case 'ACTIVE':
      case 'READY':
        return 'READY';
      case 'DELETED':
        return 'DELETED';
      default:
        return 'ERROR';
    }
  }

  private handleError(err: any): never {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      throw new ProviderAuthError('DOODSTREAM');
    }
    if (status === 429) {
      throw new ProviderRateLimitError('DOODSTREAM');
    }
    if (status === 404) {
      throw new ProviderNotFoundError('DOODSTREAM');
    }
    if (err instanceof ProviderAuthError || err instanceof ProviderRateLimitError ||
        err instanceof ProviderNotFoundError || err instanceof ProviderUnavailableError) {
      throw err;
    }
    this.logger.error(`DoodStream API error: ${err?.message}`);
    throw new ProviderUnavailableError('DOODSTREAM', err?.message);
  }
}
