import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Provider, UploadSourceType } from '@prisma/client';

export class CreateUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(UploadSourceType)
  sourceType: UploadSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}
