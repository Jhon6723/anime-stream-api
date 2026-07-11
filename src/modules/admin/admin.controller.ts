import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemConfigCategory, UserRole } from '@prisma/client';
import {
    type AuthUser,
    CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { HardDeleteDto } from './dto/hard-delete.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { UpdateVideoSourceDto } from './dto/update-video-source.dto';
import { SystemConfigService } from './system-config.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Delete('animes/:id')
  hardDeleteAnime(
    @Param('id') id: string,
    @Body() dto: HardDeleteDto,
    @CurrentUser() admin: AuthUser,
  ) {
    if (dto.confirm !== 'CONFIRM') {
      throw new BadRequestException('Confirm field must be "CONFIRM"');
    }
    return this.adminService.hardDeleteAnime(id, admin.id, dto.reason);
  }

  @Delete('episodes/:id')
  hardDeleteEpisode(
    @Param('id') id: string,
    @Body() dto: HardDeleteDto,
    @CurrentUser() admin: AuthUser,
  ) {
    if (dto.confirm !== 'CONFIRM') {
      throw new BadRequestException('Confirm field must be "CONFIRM"');
    }
    return this.adminService.hardDeleteEpisode(id, admin.id, dto.reason);
  }

  @Patch('episodes/:id')
  updateEpisode(
    @Param('id') id: string,
    @Body() dto: UpdateEpisodeDto,
  ) {
    return this.adminService.updateEpisode(id, dto);
  }

  @Patch('video-sources/:id')
  updateVideoSource(
    @Param('id') id: string,
    @Body() dto: UpdateVideoSourceDto,
  ) {
    return this.adminService.updateVideoSource(id, dto);
  }

  @Delete('video-sources/:id')
  hardDeleteVideoSource(
    @Param('id') id: string,
    @Body() dto: HardDeleteDto,
    @CurrentUser() admin: AuthUser,
  ) {
    if (dto.confirm !== 'CONFIRM') {
      throw new BadRequestException('Confirm field must be "CONFIRM"');
    }
    return this.adminService.hardDeleteVideoSource(id, admin.id, dto.reason);
  }

  @Get('config')
  config(@Query('category') category?: SystemConfigCategory) {
    if (category) {
      return this.systemConfigService.findByCategory(category);
    }
    return this.systemConfigService.findAll();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateSystemConfigDto) {
    return this.systemConfigService.upsert(dto);
  }

  @Delete('config/:key')
  deleteConfig(@Param('key') key: string) {
    return this.systemConfigService.remove(key);
  }
}
