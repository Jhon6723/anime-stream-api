import { Module } from '@nestjs/common';
import { AnimeController } from './anime.controller';
import { AnimeService } from './anime.service';
import { HomeController } from './home.controller';

@Module({
  controllers: [AnimeController, HomeController],
  providers: [AnimeService],
  exports: [AnimeService],
})
export class AnimeModule {}
