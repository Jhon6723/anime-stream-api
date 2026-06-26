import {
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Provider } from '@prisma/client';
import { Type } from 'class-transformer';

export class BulkUploadItemDto {
  @IsUUID()
  episodeId: string;

  @IsString()
  url: string;
}

export class BulkUploadDto {
  @IsEnum(Provider)
  provider: Provider;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUploadItemDto)
  items: BulkUploadItemDto[];
}
