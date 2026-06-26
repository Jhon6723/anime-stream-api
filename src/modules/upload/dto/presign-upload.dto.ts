import { IsEnum, IsUUID } from 'class-validator';
import { Provider } from '@prisma/client';

export class PresignUploadDto {
  @IsUUID()
  episodeId: string;

  @IsEnum(Provider)
  provider: Provider;
}
