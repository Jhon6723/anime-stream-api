import { Provider } from '@prisma/client';

export interface UploadResult {
  providerFileId: string;
  embedUrl: string;
  downloadUrl?: string;
}

export interface RemoteUploadResult {
  trackingId: string;
}

export interface ProviderFileInfo {
  providerFileId: string;
  status: 'UPLOADING' | 'ENCODING' | 'READY' | 'ERROR' | 'DELETED';
  views?: number;
  earnings?: number;
}

export interface ProviderAccountInfo {
  balance?: number;
  email?: string;
}

/**
 * Interfaz común implementada por todos los adapters de proveedores de video.
 * Ver spec 011 (multi-provider). Permite intercambiar proveedores sin cambiar
 * la lógica de upload/cola.
 */
export interface VideoProvider {
  readonly provider: Provider;

  uploadFile(filePath: string, apiKey: string): Promise<UploadResult>;
  remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult>;
  getFileInfo(
    providerFileId: string,
    apiKey: string,
  ): Promise<ProviderFileInfo>;
  deleteFile(providerFileId: string, apiKey: string): Promise<void>;
  buildEmbedUrl(providerFileId: string): string;
  getAccountInfo?(apiKey: string): Promise<ProviderAccountInfo>;
}
