import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { UPLOAD_QUEUE } from '../../queue/queue.constants';
import { WebsocketModule } from '../../websocket/websocket.module';
import { ProvidersModule } from '../providers/providers.module';
import { UploadController } from './upload.controller';
import { UploadProcessor } from './upload.processor';
import { UploadService } from './upload.service';
import { VideoSourceSyncService } from './video-source-sync.service';

@Module({
  imports: [
    ProvidersModule,
    WebsocketModule,
    BullModule.registerQueue({ name: UPLOAD_QUEUE }),
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadProcessor, VideoSourceSyncService],
  exports: [UploadService, VideoSourceSyncService],
})
export class UploadModule {}
