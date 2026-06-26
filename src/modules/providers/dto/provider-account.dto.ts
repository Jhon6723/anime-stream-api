import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Provider } from '@prisma/client';

export class CreateProviderAccountDto {
  @IsEnum(Provider)
  provider: Provider;

  @IsString()
  label: string;

  @IsString()
  apiKey: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority?: number;
}

export class UpdateProviderAccountDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority?: number;
}
