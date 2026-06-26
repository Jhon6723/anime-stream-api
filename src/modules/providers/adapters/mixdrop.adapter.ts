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
  ProviderFileInfo,
  RemoteUploadResult,
  RemoteUploadStatus,
  UploadResult,
  VideoProvider,
} from '../video-provider.interface';

interface MixdropUploadResponse {
  success: boolean;
  result?: { fileref?: string; url?: string; embedurl?: string };
}

interface MixdropRemoteUploadResponse {
  success: boolean;
  result?: { id?: string | number; fileref?: string; url?: string; embedurl?: string };
}

interface MixdropRemoteStatusResponse {
  success: boolean;
  result?: MixdropRemoteStatusItem;
}

interface MixdropRemoteStatusItem {
  status?: string;
  error?: string;
  fileref?: string;
  url?: string;
}

interface MixdropFileInfoResponse {
  success: boolean;
  result?: MixdropFileInfoItem | MixdropFileInfoItem[];
}

interface MixdropFileInfoItem {
  fileref: string;
  status: string;
}

interface MixdropDeleteResponse {
  success: boolean;
}

/**
 * Adapter MixDrop. Ver spec 005-upload-mixdrop.
 * API docs: https://mixdrop.co/api
 * Auth: email + key como query params.
 */
@Injectable()
export class MixdropAdapter implements VideoProvider {
  private readonly logger = new Logger(MixdropAdapter.name);
  readonly provider = Provider.MIXDROP;
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('providers.mixdrop.baseUrl')!;
    this.uploadBaseUrl =
      this.config.get<string>('providers.mixdrop.uploadBaseUrl') ??
      'https://ul.mixdrop.ag/api';
  }
  private readonly uploadBaseUrl: string;

  async uploadFile(filePath: string, apiKey: string): Promise<UploadResult> {
    try {
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const form = new FormData();
      form.append('email', email);
      form.append('key', apiKey);
      form.append('file', createReadStream(filePath));

      const { data } = await firstValueFrom(
        this.http.post<MixdropUploadResponse>(this.uploadBaseUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (!data.success || !data.result?.fileref) {
        throw new ProviderUnavailableError('MIXDROP', 'Upload failed');
      }

      const providerFileId = data.result.fileref;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
        downloadUrl: data.result.url,
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
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const form = new FormData();
      form.append('email', email);
      form.append('key', apiKey);
      form.append('file', fileBuffer, fileName);

      const { data } = await firstValueFrom(
        this.http.post<MixdropUploadResponse>(this.uploadBaseUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      if (!data.success || !data.result?.fileref) {
        throw new ProviderUnavailableError('MIXDROP', 'Upload failed');
      }

      const providerFileId = data.result.fileref;

      return {
        providerFileId,
        embedUrl: this.buildEmbedUrl(providerFileId),
        downloadUrl: data.result.url,
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult> {
    try {
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const { data } = await firstValueFrom(
        this.http.get<MixdropRemoteUploadResponse>(
          `${this.baseUrl}/remoteupload`,
          {
            params: { email, key: apiKey, url },
          },
        ),
      );

      if (!data.success || !data.result?.id) {
        throw new ProviderUnavailableError('MIXDROP', 'Remote upload failed');
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
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const { data } = await firstValueFrom(
        this.http.get<MixdropRemoteStatusResponse>(
          `${this.baseUrl}/remotestatus`,
          {
            params: { email, key: apiKey, id: trackingId },
          },
        ),
      );

      if (!data.success || !data.result) {
        return { status: 'PENDING' };
      }

      const result = data.result;
      if (result.status === 'Error' || result.error) {
        return { status: 'FAILED' };
      }

      if (result.status === 'Complete' && result.fileref) {
        const providerFileId = result.fileref;
        return {
          status: 'COMPLETED',
          providerFileId,
          embedUrl: this.buildEmbedUrl(providerFileId),
          downloadUrl: result.url,
        };
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
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const { data } = await firstValueFrom(
        this.http.get<MixdropFileInfoResponse>(`${this.baseUrl}/fileinfo2`, {
          params: { email, key: apiKey, 'ref[]': providerFileId },
        }),
      );

      if (!data.success || !data.result) {
        throw new ProviderNotFoundError(
          'MIXDROP',
          `File ${providerFileId} not found`,
        );
      }

      const file = Array.isArray(data.result) ? data.result[0] : data.result;
      return {
        providerFileId: file.fileref,
        status: this.mapStatus(file.status),
      };
    } catch (err) {
      this.handleError(err);
    }
  }

  async deleteFile(providerFileId: string, apiKey: string): Promise<void> {
    try {
      const email = this.config.get<string>('providers.mixdrop.email')!;

      const { data } = await firstValueFrom(
        this.http.get<MixdropDeleteResponse>(`${this.baseUrl}/filedelete`, {
          params: { email, key: apiKey, ref: providerFileId },
        }),
      );

      if (!data.success) {
        throw new ProviderNotFoundError(
          'MIXDROP',
          `File ${providerFileId} not found or already deleted`,
        );
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://mixdrop.ag/e/${providerFileId}`;
  }

  private mapStatus(status: string): ProviderFileInfo['status'] {
    switch (status?.toLowerCase()) {
      case 'convert queue':
      case 'converting':
      case 'processing':
      case 'completing':
      case 'uploading':
        return 'ENCODING';
      case 'ok':
      case 'active':
      case 'ready':
      case 'finished':
        return 'READY';
      case 'deleted':
        return 'DELETED';
      default:
        return 'ERROR';
    }
  }

  private handleError(err: unknown): never {
    const { status, message } = getHttpErrorInfo(err);
    if (status === 401 || status === 403) {
      throw new ProviderAuthError('MIXDROP');
    }
    if (status === 429) {
      throw new ProviderRateLimitError('MIXDROP');
    }
    if (status === 404) {
      throw new ProviderNotFoundError('MIXDROP');
    }
    if (
      err instanceof ProviderAuthError ||
      err instanceof ProviderRateLimitError ||
      err instanceof ProviderNotFoundError ||
      err instanceof ProviderUnavailableError
    ) {
      throw err;
    }
    this.logger.error(`MixDrop API error: ${message}`);
    throw new ProviderUnavailableError('MIXDROP', message);
  }
}
