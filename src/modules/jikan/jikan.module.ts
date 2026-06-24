import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JikanService } from './jikan.service';

@Module({
  imports: [HttpModule],
  providers: [JikanService],
  exports: [JikanService],
})
export class JikanModule {}
