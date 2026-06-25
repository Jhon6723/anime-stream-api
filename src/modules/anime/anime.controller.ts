import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AnimeService } from './anime.service';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @Public()
  @Get()
  findCatalog(
    @Query('q') q?: string,
    @Query('genre') genre?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.animeService.findCatalog({
      q,
      genre,
      status,
      type,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.animeService.findBySlug(slug);
  }

  @Public()
  @Get(':slug/episodes/:number')
  findEpisode(
    @Param('slug') slug: string,
    @Param('number') numberStr: string,
  ) {
    const episodeNumber = parseInt(numberStr, 10);
    if (isNaN(episodeNumber) || episodeNumber < 1) {
      throw new NotFoundException('Invalid episode number');
    }
    return this.animeService.findEpisode(slug, episodeNumber);
  }
}
