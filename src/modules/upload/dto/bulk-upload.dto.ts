import { Provider, SubtitleLanguage } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BulkUploadItemDto {
  @IsUUID()
  episodeId: string;

  @IsString()
  url: string;

  @IsEnum(SubtitleLanguage)
  language: SubtitleLanguage;
}

export class BulkUploadDto {
  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(SubtitleLanguage)
  language: SubtitleLanguage;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUploadItemDto)
  items: BulkUploadItemDto[];
}
