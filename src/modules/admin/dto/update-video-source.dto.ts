import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateVideoSourceDto {
  @ApiPropertyOptional({ enum: ['EN', 'ES'], example: 'ES' })
  @IsOptional()
  @IsEnum(['EN', 'ES'])
  language?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/embed' })
  @IsOptional()
  @IsString()
  embedUrl?: string;
}
