import { Injectable, NotImplementedException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import {
  ProviderFileInfo,
  RemoteUploadResult,
  UploadResult,
  VideoProvider,
} from '../video-provider.interface';

/**
 * Adapter DoodStream. Ver spec 004-upload-doodstream.
 * La implementación real (HTTP a doodapi.com) se hace en la fase de
 * implementación dirigida por tests (TDD), no en el scaffold.
 */
@Injectable()
export class DoodstreamAdapter implements VideoProvider {
  readonly provider = Provider.DOODSTREAM;

  uploadFile(_filePath: string, _apiKey: string): Promise<UploadResult> {
    throw new NotImplementedException('DoodstreamAdapter.uploadFile');
  }

  remoteUpload(_url: string, _apiKey: string): Promise<RemoteUploadResult> {
    throw new NotImplementedException('DoodstreamAdapter.remoteUpload');
  }

  getFileInfo(
    _providerFileId: string,
    _apiKey: string,
  ): Promise<ProviderFileInfo> {
    throw new NotImplementedException('DoodstreamAdapter.getFileInfo');
  }

  deleteFile(_providerFileId: string, _apiKey: string): Promise<void> {
    throw new NotImplementedException('DoodstreamAdapter.deleteFile');
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://dood.to/e/${providerFileId}`;
  }
}
