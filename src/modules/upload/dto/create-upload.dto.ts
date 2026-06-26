import { Provider, SubtitleLanguage, UploadSourceType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(UploadSourceType)
  sourceType: UploadSourceType;

  @IsEnum(SubtitleLanguage)
  language: SubtitleLanguage;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}
