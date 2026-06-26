import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('queue')
  pendingQueue(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.moderationService.pendingQueue(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 24,
    );
  }

  @Get('logs')
  auditLog(@Query('episodeId') episodeId?: string) {
    return this.moderationService.auditLog(episodeId);
  }

  @Post('episodes/:id/approve')
  approve(
    @Param('id') episodeId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.moderationService.approve(episodeId, user.id, dto.reason, dto.notes);
  }

  @Post('episodes/:id/warn')
  warn(
    @Param('id') episodeId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.moderationService.warn(episodeId, user.id, dto.reason, dto.notes);
  }

  @Post('episodes/:id/disable')
  disable(
    @Param('id') episodeId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.moderationService.disable(episodeId, user.id, dto.reason, dto.notes);
  }

  @Post('episodes/:id/enable')
  enable(
    @Param('id') episodeId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.moderationService.enable(episodeId, user.id, dto.reason, dto.notes);
  }
}
