import { Provider, SubtitleLanguage } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class PresignUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(SubtitleLanguage)
  language: SubtitleLanguage;
}
