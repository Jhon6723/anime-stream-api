import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { AnimeController } from './anime.controller';
import { AnimeService } from './anime.service';
import { HomeController } from './home.controller';

@Module({
  imports: [UploadModule],
  controllers: [AnimeController, HomeController],
  providers: [AnimeService],
  exports: [AnimeService],
})
export class AnimeModule {}
