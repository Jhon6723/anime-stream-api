import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerationActionDto {
  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
