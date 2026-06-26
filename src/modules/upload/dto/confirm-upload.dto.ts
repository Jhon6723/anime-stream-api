import { Provider, SubtitleLanguage } from '@prisma/client';
import { IsEnum, IsString, IsUUID } from 'class-validator';

export class ConfirmUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(SubtitleLanguage)
  language: SubtitleLanguage;

  @IsString()
  providerFileId: string;

  @IsString()
  embedUrl: string;

  @IsString()
  downloadUrl?: string;
}
