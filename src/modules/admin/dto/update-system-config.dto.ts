import { ApiProperty } from '@nestjs/swagger';
import { SystemConfigCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateSystemConfigDto {
  @ApiProperty({ example: 'seo.title' })
  @IsString()
  @MinLength(1)
  key: string;

  @ApiProperty({ example: 'AnimeStream - Ver anime online' })
  @IsString()
  @MinLength(1)
  value: string;

  @ApiProperty({ enum: SystemConfigCategory, required: false })
  @IsOptional()
  @IsEnum(SystemConfigCategory)
  category?: SystemConfigCategory;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}
