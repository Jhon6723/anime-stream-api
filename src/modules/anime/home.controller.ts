import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AnimeService } from './anime.service';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly animeService: AnimeService) {}

  @Public()
  @Get()
  findHome() {
    return this.animeService.findHome();
  }
}
