import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JikanController } from './jikan.controller';
import { JikanService } from './jikan.service';

@Module({
  imports: [HttpModule],
  controllers: [JikanController],
  providers: [JikanService],
  exports: [JikanService],
})
export class JikanModule {}
