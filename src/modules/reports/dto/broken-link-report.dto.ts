import { IsString, IsUUID, MaxLength } from 'class-validator';

export class BrokenLinkReportDto {
  @IsUUID()
  videoSourceId: string;

  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
