import { Injectable, NotImplementedException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import {
  ProviderFileInfo,
  RemoteUploadResult,
  UploadResult,
  VideoProvider,
} from '../video-provider.interface';

/**
 * Adapter MixDrop. Ver spec 005-upload-mixdrop.
 */
@Injectable()
export class MixdropAdapter implements VideoProvider {
  readonly provider = Provider.MIXDROP;

  uploadFile(_filePath: string, _apiKey: string): Promise<UploadResult> {
    throw new NotImplementedException('MixdropAdapter.uploadFile');
  }

  remoteUpload(_url: string, _apiKey: string): Promise<RemoteUploadResult> {
    throw new NotImplementedException('MixdropAdapter.remoteUpload');
  }

  getFileInfo(
    _providerFileId: string,
    _apiKey: string,
  ): Promise<ProviderFileInfo> {
    throw new NotImplementedException('MixdropAdapter.getFileInfo');
  }

  deleteFile(_providerFileId: string, _apiKey: string): Promise<void> {
    throw new NotImplementedException('MixdropAdapter.deleteFile');
  }

  buildEmbedUrl(providerFileId: string): string {
    return `https://mixdrop.co/e/${providerFileId}`;
  }
}
