import { Provider } from '@prisma/client';

export interface UploadResult {
  providerFileId: string;
  embedUrl: string;
  downloadUrl?: string;
}

export interface RemoteUploadResult {
  trackingId: string;
}

export interface RemoteUploadStatus {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  providerFileId?: string;
  embedUrl?: string;
  downloadUrl?: string;
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

export interface PresignResult {
  uploadUrl: string;
  /**
   * Campos extra que el cliente debe enviar junto al archivo en el POST al provider.
   * Ej: DoodStream requiere { api_key: "..." } como campo del multipart.
   */
  extraFields?: Record<string, string>;
  /**
   * Si es true, el provider requiere que el server haga proxy del upload
   * porque los extraFields contienen secrets (ej: api_key).
   * El cliente NO debe recibir los extraFields.
   */
  requiresServerProxy?: boolean;
}

/**
 * Interfaz común implementada por todos los adapters de proveedores de video.
 * Ver spec 011 (multi-provider). Permite intercambiar proveedores sin cambiar
 * la lógica de upload/cola.
 */
export interface VideoProvider {
  readonly provider: Provider;

  /**
   * Subir archivo local al provider. Usa el servidor como intermediario.
   * Solo usar cuando no hay opción de presign.
   */
  uploadFile(filePath: string, apiKey: string): Promise<UploadResult>;

  /**
   * Subir archivo desde un buffer en memoria (streaming proxy).
   * No toca disco. El server inyecta los secrets (api_key) y forwarda al provider.
   */
  streamUpload?(fileBuffer: Buffer, fileName: string, apiKey: string): Promise<UploadResult>;

  /**
   * Obtener una URL temporal de upload (presign) para que el cliente
   * suba el archivo directamente al provider sin pasar por nuestro server.
   * Retorna null si el provider no soporta presign (ej: MixDrop).
   */
  getUploadUrl?(apiKey: string): Promise<PresignResult>;

  remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult>;
  checkRemoteUpload(trackingId: string, apiKey: string): Promise<RemoteUploadStatus>;
  getFileInfo(
    providerFileId: string,
    apiKey: string,
  ): Promise<ProviderFileInfo>;
  deleteFile(providerFileId: string, apiKey: string): Promise<void>;
  buildEmbedUrl(providerFileId: string): string;
  getAccountInfo?(apiKey: string): Promise<ProviderAccountInfo>;
}
