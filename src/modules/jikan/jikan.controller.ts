import { BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JikanService } from './jikan.service';

@ApiTags('jikan')
@Controller('jikan')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JikanController {
  constructor(private readonly jikanService: JikanService) {}

  @Roles('UPLOADER', 'ADMIN', 'MODERATOR')
  @Get('search')
  search(
    @Query('q') q: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    return this.jikanService.search(q, page, limit);
  }

  @Roles('UPLOADER', 'ADMIN', 'MODERATOR')
  @Get('seasons/now')
  getSeasonNow(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 15;
    return this.jikanService.getSeasonNow(page, limit);
  }

  @Roles('UPLOADER', 'ADMIN', 'MODERATOR')
  @Get('anime/:malId')
  getAnimePreview(@Param('malId') malIdStr: string) {
    const malId = parseInt(malIdStr, 10);
    if (isNaN(malId) || malId < 1) {
      throw new BadRequestException('Invalid MAL ID');
    }
    return this.jikanService.getAnimePreview(malId);
  }

  @Roles('UPLOADER', 'ADMIN')
  @Post('import/:malId')
  importAnime(
    @Param('malId') malIdStr: string,
    @CurrentUser() user: AuthUser,
  ) {
    const malId = parseInt(malIdStr, 10);
    if (isNaN(malId) || malId < 1) {
      throw new BadRequestException('Invalid MAL ID');
    }
    return this.jikanService.importAnime(malId, user.id);
  }
}
