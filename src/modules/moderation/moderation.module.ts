import { Module } from '@nestjs/common';
import { WebsocketModule } from '../../websocket/websocket.module';
import { UploadModule } from '../upload/upload.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [WebsocketModule, UploadModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
