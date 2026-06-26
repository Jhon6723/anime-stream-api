import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnimeService } from './anime.service';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @Public()
  @Post('search')
  findCatalog(
    @Body()
    body: {
      q?: string;
      genre?: string;
      status?: string;
      type?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.animeService.findCatalog(body);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.animeService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @Get(':slug/episodes')
  findEpisodesForUpload(
    @Param('slug') slug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const pageSize = Math.min(
      pageSizeStr ? parseInt(pageSizeStr, 10) : 50,
      100,
    );
    return this.animeService.findEpisodesForUpload(slug, page, pageSize);
  }

  @Public()
  @Get(':slug/episodes/:number')
  findEpisode(@Param('slug') slug: string, @Param('number') numberStr: string) {
    const episodeNumber = parseInt(numberStr, 10);
    if (isNaN(episodeNumber) || episodeNumber < 1) {
      throw new NotFoundException('Invalid episode number');
    }
    return this.animeService.findEpisode(slug, episodeNumber);
  }
}
