import { IsEnum, IsString, IsUUID } from 'class-validator';
import { Provider } from '@prisma/client';

export class ConfirmUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsString()
  providerFileId: string;

  @IsString()
  embedUrl: string;

  @IsString()
  downloadUrl?: string;
}
