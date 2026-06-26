import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@prisma/client';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { firstValueFrom } from 'rxjs';
import {
  ProviderAuthError,
  ProviderNotFoundError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  getHttpErrorInfo,
} from '../provider-errors';
import {
  PresignResult,
  ProviderFileInfo,
  RemoteUploadResult,
  RemoteUploadStatus,
  UploadResult,
  VideoProvider,
} from '../video-provider.interface';

interface DoodUploadServerResponse {
  status: number;
  result?: string;
}

interface DoodUploadedFile {
  filecode: string;
  download_url?: string;
}

interface DoodUploadResponse {
  status: number;
  result?: DoodUploadedFile[];
}

interface DoodRemoteUploadResponse {
  status: number;
  result?: string | { filecode: string };
}

interface DoodFileInfoResponse {
  status: number;
  result?: DoodFileInfoItem[];
}

interface DoodFileInfoItem {
  filecode: string;
  canplay?: number;
  views?: string;
}

interface DoodDeleteResponse {
  status: number;
}

/**
 * Adapter DoodStream. Ver spec 004-upload-doodstream.
 * API docs: https://doodstream.com/api-docs
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
        this.http.get<DoodUploadServerResponse>(
          `${this.baseUrl}/upload/server`,
          {
            params: { key: apiKey },
          },
        ),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError(
          'DOODSTREAM',
          'Failed to get upload server',
        );
      }

      const uploadUrl = data.result;

      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('file', createReadStream(filePath));

      const uploadRes = await firstValueFrom(
        this.http.post<DoodUploadResponse>(uploadUrl, form, {
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
      this.handleError(err);
    }
  }

  async getUploadUrl(apiKey: string): Promise<PresignResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<DoodUploadServerResponse>(
          `${this.baseUrl}/upload/server`,
          {
            params: { key: apiKey },
          },
        ),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError(
          'DOODSTREAM',
          'Failed to get upload server',
        );
      }

      return {
        uploadUrl: data.result,
        extraFields: { api_key: apiKey },
        requiresServerProxy: true,
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async streamUpload(
    fileBuffer: Buffer,
    fileName: string,
    apiKey: string,
  ): Promise<UploadResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<DoodUploadServerResponse>(
          `${this.baseUrl}/upload/server`,
          {
            params: { key: apiKey },
          },
        ),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError(
          'DOODSTREAM',
          'Failed to get upload server',
        );
      }

      const uploadUrl = data.result;

      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('file', fileBuffer, fileName);

      const uploadRes = await firstValueFrom(
        this.http.post<DoodUploadResponse>(uploadUrl, form, {
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
      this.handleError(err);
    }
  }

  async remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<DoodRemoteUploadResponse>(`${this.baseUrl}/upload/url`, {
          params: { key: apiKey, url },
        }),
      );

      if (data.status !== 200 || !data.result) {
        throw new ProviderUnavailableError(
          'DOODSTREAM',
          'Remote upload failed',
        );
      }

      const result = data.result;
      return {
        trackingId: typeof result === 'string' ? result : result.filecode,
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async checkRemoteUpload(
    trackingId: string,
    apiKey: string,
  ): Promise<RemoteUploadStatus> {
    try {
      const info = await this.getFileInfo(trackingId, apiKey);
      return {
        status:
          info.status === 'READY' || info.status === 'ENCODING'
            ? 'COMPLETED'
            : 'PENDING',
        providerFileId: info.providerFileId,
        embedUrl: this.buildEmbedUrl(info.providerFileId),
      };
    } catch {
      return { status: 'PENDING' };
    }
  }

  async getFileInfo(
    providerFileId: string,
    apiKey: string,
  ): Promise<ProviderFileInfo> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<DoodFileInfoResponse>(`${this.baseUrl}/file/info`, {
          params: { key: apiKey, file_code: providerFileId },
        }),
      );

      if (data.status !== 200 || !data.result?.[0]) {
        throw new ProviderNotFoundError(
          'DOODSTREAM',
          `File ${providerFileId} not found`,
        );
      }

      const file = data.result[0];
      const canplay = file.canplay ?? 0;
      return {
        providerFileId: file.filecode,
        status: canplay === 1 ? 'READY' : 'ENCODING',
        views: parseInt(file.views ?? '0', 10),
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async deleteFile(providerFileId: string, apiKey: string): Promise<void> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<DoodDeleteResponse>(`${this.baseUrl}/file/delete`, {
          params: { key: apiKey, file_code: providerFileId },
        }),
      );

      if (data.status !== 200) {
        throw new ProviderNotFoundError(
          'DOODSTREAM',
          `File ${providerFileId} not found or already deleted`,
        );
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://dood.to/e/${providerFileId}`;
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

  private handleError(err: unknown): never {
    const { status, message } = getHttpErrorInfo(err);
    if (status === 401 || status === 403) {
      throw new ProviderAuthError('DOODSTREAM');
    }
    if (status === 429) {
      throw new ProviderRateLimitError('DOODSTREAM');
    }
    if (status === 404) {
      throw new ProviderNotFoundError('DOODSTREAM');
    }
    if (
      err instanceof ProviderAuthError ||
      err instanceof ProviderRateLimitError ||
      err instanceof ProviderNotFoundError ||
      err instanceof ProviderUnavailableError
    ) {
      throw err;
    }
    this.logger.error(`DoodStream API error: ${message}`);
    throw new ProviderUnavailableError('DOODSTREAM', message);
  }
}
