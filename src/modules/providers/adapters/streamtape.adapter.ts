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

interface StreamtapeUploadUrlResponse {
  status: number;
  result?: { url?: string };
}

interface StreamtapeUploadResponse {
  status: number;
  result?: { id?: string };
}

interface StreamtapeRemoteAddResponse {
  status: number;
  result?: { id?: string };
}

interface StreamtapeRemoteStatusResponse {
  status: number;
  result?:
    | Record<string, StreamtapeRemoteStatusItem>
    | StreamtapeRemoteStatusItem;
}

interface StreamtapeRemoteStatusItem {
  id?: string;
  status?: string;
  remoteurl?: string;
  url?: boolean | string;
  extid?: boolean | string;
}

interface StreamtapeFileInfoResponse {
  status: number;
  result?: Record<string, StreamtapeFileInfoItem>;
}

interface StreamtapeFileInfoItem {
  id: string;
  converted: boolean;
}

interface StreamtapeFolderResponse {
  status: number;
  result?: { files?: StreamtapeFolderFile[] };
}

interface StreamtapeFolderFile {
  linkid: string;
  downloads?: number;
}

interface StreamtapeDeleteResponse {
  status: number;
}

interface StreamtapeSplashResponse {
  status: number;
  result?: string;
}

/**
 * Adapter Streamtape. Ver spec 006-upload-streamtape.
 * API docs: https://streamtape.com/api
 * Auth: login + key como query params.
 * Upload es en dos pasos: GET /file/ul para URL temporal, luego POST multipart.
 */
@Injectable()
export class StreamtapeAdapter implements VideoProvider {
  private readonly logger = new Logger(StreamtapeAdapter.name);
  readonly provider = Provider.STREAMTAPE;
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('providers.streamtape.baseUrl')!;
  }

  async uploadFile(filePath: string, apiKey: string): Promise<UploadResult> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data: ulData } = await firstValueFrom(
        this.http.get<StreamtapeUploadUrlResponse>(`${this.baseUrl}/file/ul`, {
          params: { login, key: apiKey },
        }),
      );

      if (ulData.status !== 200 || !ulData.result?.url) {
        throw new ProviderUnavailableError(
          'STREAMTAPE',
          'Failed to get upload URL',
        );
      }

      const uploadUrl = ulData.result.url;

      const form = new FormData();
      form.append('file', createReadStream(filePath));

      const uploadRes = await firstValueFrom(
        this.http.post<StreamtapeUploadResponse>(uploadUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (uploadRes.data.status !== 200 || !uploadRes.data.result?.id) {
        throw new ProviderUnavailableError('STREAMTAPE', 'Upload failed');
      }

      const providerFileId = uploadRes.data.result.id;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
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
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data: ulData } = await firstValueFrom(
        this.http.get<StreamtapeUploadUrlResponse>(`${this.baseUrl}/file/ul`, {
          params: { login, key: apiKey },
        }),
      );

      if (ulData.status !== 200 || !ulData.result?.url) {
        throw new ProviderUnavailableError(
          'STREAMTAPE',
          'Failed to get upload URL',
        );
      }

      const uploadUrl = ulData.result.url;

      const form = new FormData();
      form.append('file', fileBuffer, fileName);

      const uploadRes = await firstValueFrom(
        this.http.post<StreamtapeUploadResponse>(uploadUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (uploadRes.data.status !== 200 || !uploadRes.data.result?.id) {
        throw new ProviderUnavailableError('STREAMTAPE', 'Upload failed');
      }

      const providerFileId = uploadRes.data.result.id;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async getUploadUrl(apiKey: string): Promise<PresignResult> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeUploadUrlResponse>(`${this.baseUrl}/file/ul`, {
          params: { login, key: apiKey },
        }),
      );

      if (data.status !== 200 || !data.result?.url) {
        throw new ProviderUnavailableError(
          'STREAMTAPE',
          'Failed to get upload URL',
        );
      }

      return {
        uploadUrl: data.result.url,
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeRemoteAddResponse>(
          `${this.baseUrl}/remotedl/add`,
          {
            params: { login, key: apiKey, url },
          },
        ),
      );

      if (data.status !== 200 || !data.result?.id) {
        throw new ProviderUnavailableError(
          'STREAMTAPE',
          'Remote upload failed',
        );
      }

      return { trackingId: String(data.result.id) };
    } catch (err) {
      this.handleError(err);
    }
  }

  async checkRemoteUpload(
    trackingId: string,
    apiKey: string,
  ): Promise<RemoteUploadStatus> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeRemoteStatusResponse>(
          `${this.baseUrl}/remotedl/status`,
          {
            params: { login, key: apiKey, id: trackingId },
          },
        ),
      );

      if (data.status !== 200 || !data.result) {
        return { status: 'PENDING' };
      }

      const rawResult = data.result;
      const result: StreamtapeRemoteStatusItem | undefined =
        trackingId in rawResult
          ? (rawResult as Record<string, StreamtapeRemoteStatusItem>)[
              trackingId
            ]
          : rawResult;
      if (!result) {
        return { status: 'PENDING' };
      }

      const status = (result.status ?? '').toLowerCase();
      if (status === 'error' || status === 'failed') {
        return { status: 'FAILED' };
      }

      if (
        status === 'complete' ||
        status === 'completed' ||
        status === 'finished'
      ) {
        const extid =
          typeof result.extid === 'string' ? result.extid : undefined;
        const fileId = result.id ?? extid ?? trackingId;
        try {
          const info = await this.getFileInfo(fileId, apiKey);
          return {
            status: 'COMPLETED',
            providerFileId: info.providerFileId,
            embedUrl: this.buildEmbedUrl(info.providerFileId),
          };
        } catch {
          return {
            status: 'COMPLETED',
            providerFileId: fileId,
            embedUrl: this.buildEmbedUrl(fileId),
          };
        }
      }

      return { status: 'PENDING' };
    } catch {
      return { status: 'PENDING' };
    }
  }

  async getFileInfo(
    providerFileId: string,
    apiKey: string,
  ): Promise<ProviderFileInfo> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeFileInfoResponse>(`${this.baseUrl}/file/info`, {
          params: { login, key: apiKey, file: providerFileId },
        }),
      );

      if (data.status !== 200 || !data.result?.[providerFileId]) {
        throw new ProviderNotFoundError(
          'STREAMTAPE',
          `File ${providerFileId} not found`,
        );
      }

      const file = data.result[providerFileId];

      let views = 0;
      try {
        const { data: folderData } = await firstValueFrom(
          this.http.get<StreamtapeFolderResponse>(
            `${this.baseUrl}/file/listfolder`,
            {
              params: { login, key: apiKey },
            },
          ),
        );
        if (folderData.status === 200 && folderData.result?.files) {
          const matched = folderData.result.files.find(
            (f: StreamtapeFolderFile) => f.linkid === providerFileId,
          );
          if (matched) {
            views = matched.downloads ?? 0;
          }
        }
      } catch {
        this.logger.warn(
          `Failed to fetch listfolder for views lookup: ${providerFileId}`,
        );
      }

      return {
        providerFileId: file.id,
        status: this.mapStatus(file.converted),
        views,
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async getThumbnail(
    providerFileId: string,
    apiKey: string,
  ): Promise<string | null> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeSplashResponse>(
          `${this.baseUrl}/file/getsplash`,
          {
            params: { login, key: apiKey, file: providerFileId },
          },
        ),
      );

      if (data.status !== 200 || !data.result) {
        return null;
      }

      return data.result;
    } catch {
      return null;
    }
  }

  async deleteFile(providerFileId: string, apiKey: string): Promise<void> {
    try {
      const login = this.config.get<string>('providers.streamtape.login')!;

      const { data } = await firstValueFrom(
        this.http.get<StreamtapeDeleteResponse>(`${this.baseUrl}/file/delete`, {
          params: { login, key: apiKey, file: providerFileId },
        }),
      );

      if (data.status !== 200) {
        throw new ProviderNotFoundError(
          'STREAMTAPE',
          `File ${providerFileId} not found or already deleted`,
        );
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://streamtape.com/e/${providerFileId}`;
  }

  private mapStatus(converted: boolean): ProviderFileInfo['status'] {
    if (converted === true) return 'READY';
    if (converted === false) return 'ENCODING';
    return 'ERROR';
  }

  private handleError(err: unknown): never {
    const { status, message } = getHttpErrorInfo(err);
    if (status === 401 || status === 403) {
      throw new ProviderAuthError('STREAMTAPE');
    }
    if (status === 429) {
      throw new ProviderRateLimitError('STREAMTAPE');
    }
    if (status === 404) {
      throw new ProviderNotFoundError('STREAMTAPE');
    }
    if (
      err instanceof ProviderAuthError ||
      err instanceof ProviderRateLimitError ||
      err instanceof ProviderNotFoundError ||
      err instanceof ProviderUnavailableError
    ) {
      throw err;
    }
    this.logger.error(`Streamtape API error: ${message}`);
    throw new ProviderUnavailableError('STREAMTAPE', message);
  }
}
