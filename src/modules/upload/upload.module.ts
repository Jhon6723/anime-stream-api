import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { UPLOAD_QUEUE } from '../../queue/queue.constants';
import { UploadController } from './upload.controller';
import { UploadProcessor } from './upload.processor';
import { UploadService } from './upload.service';

@Module({
  imports: [ProvidersModule, BullModule.registerQueue({ name: UPLOAD_QUEUE })],
  controllers: [UploadController],
  providers: [UploadService, UploadProcessor],
  exports: [UploadService],
})
export class UploadModule {}
