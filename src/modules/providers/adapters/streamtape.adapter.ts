import { Injectable, NotImplementedException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import {
  ProviderFileInfo,
  RemoteUploadResult,
  UploadResult,
  VideoProvider,
} from '../video-provider.interface';

/**
 * Adapter Streamtape. Ver spec 006-upload-streamtape.
 */
@Injectable()
export class StreamtapeAdapter implements VideoProvider {
  readonly provider = Provider.STREAMTAPE;

  uploadFile(_filePath: string, _apiKey: string): Promise<UploadResult> {
    throw new NotImplementedException('StreamtapeAdapter.uploadFile');
  }

  remoteUpload(_url: string, _apiKey: string): Promise<RemoteUploadResult> {
    throw new NotImplementedException('StreamtapeAdapter.remoteUpload');
  }

  getFileInfo(
    _providerFileId: string,
    _apiKey: string,
  ): Promise<ProviderFileInfo> {
    throw new NotImplementedException('StreamtapeAdapter.getFileInfo');
  }

  deleteFile(_providerFileId: string, _apiKey: string): Promise<void> {
    throw new NotImplementedException('StreamtapeAdapter.deleteFile');
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://streamtape.com/e/${providerFileId}`;
  }
}
