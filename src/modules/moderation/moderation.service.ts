import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ModerationAction,
  ModerationStatus,
  VideoSourceStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../websocket/events.gateway';
import { VideoSourceSyncService } from '../upload/video-source-sync.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly syncService: VideoSourceSyncService,
  ) {}

  async pendingQueue(page = 1, pageSize = 24) {
    const skip = (page - 1) * pageSize;

    const where = {
      moderationStatus: ModerationStatus.PENDING,
      videoSources: { some: { status: { not: VideoSourceStatus.DELETED } } },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.episode.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          anime: { select: { title: true, slug: true } },
          videoSources: {
            where: { status: { not: VideoSourceStatus.DELETED } },
            select: {
              id: true,
              provider: true,
              status: true,
              embedUrl: true,
              remoteTrackingId: true,
            },
          },
        },
        skip,
        take: pageSize,
      }),
      this.prisma.episode.count({ where }),
    ]);

    const allSources = items.flatMap((ep) => ep.videoSources);
    await this.syncService.syncPendingSources(allSources);

    const refreshed = await this.prisma.episode.findMany({
      where: { id: { in: items.map((ep) => ep.id) } },
      orderBy: { createdAt: 'asc' },
      include: {
        anime: { select: { title: true, slug: true } },
        videoSources: {
          where: { status: { not: VideoSourceStatus.DELETED } },
          select: { id: true, provider: true, status: true, embedUrl: true },
        },
      },
    });

    return {
      items: refreshed.map((ep) => ({
        ...ep,
        hasVideo: ep.videoSources.length > 0,
        providers: ep.videoSources.map((vs) => vs.provider),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  auditLog(episodeId?: string) {
    return this.prisma.moderationLog.findMany({
      where: episodeId ? { episodeId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        moderator: { select: { id: true, username: true } },
        episode: {
          select: {
            id: true,
            episodeNumber: true,
            anime: { select: { title: true, slug: true } },
          },
        },
      },
    });
  }

  async approve(
    episodeId: string,
    moderatorId: string,
    reason: string,
    notes?: string,
  ) {
    const episode = await this.findEpisode(episodeId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.episode.update({
        where: { id: episodeId },
        data: { moderationStatus: ModerationStatus.APPROVED },
      }),
      this.prisma.moderationLog.create({
        data: {
          episodeId,
          animeId: episode.animeId,
          moderatorId,
          action: ModerationAction.APPROVE,
          reason,
          notes,
        },
      }),
    ]);

    this.events.emitModerationEvent({
      action: 'APPROVE',
      episodeId,
      animeId: episode.animeId,
      moderatorId,
      reason,
    });

    return updated;
  }

  async warn(
    episodeId: string,
    moderatorId: string,
    reason: string,
    notes?: string,
  ) {
    const episode = await this.findEpisode(episodeId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.episode.update({
        where: { id: episodeId },
        data: { moderationStatus: ModerationStatus.WARNED },
      }),
      this.prisma.moderationLog.create({
        data: {
          episodeId,
          animeId: episode.animeId,
          moderatorId,
          action: ModerationAction.WARNING,
          reason,
          notes,
        },
      }),
    ]);

    this.events.emitModerationEvent({
      action: 'WARNING',
      episodeId,
      animeId: episode.animeId,
      moderatorId,
      reason,
    });

    return updated;
  }

  async disable(
    episodeId: string,
    moderatorId: string,
    reason: string,
    notes?: string,
  ) {
    const episode = await this.findEpisode(episodeId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.episode.update({
        where: { id: episodeId },
        data: { isEnabled: false },
      }),
      this.prisma.moderationLog.create({
        data: {
          episodeId,
          animeId: episode.animeId,
          moderatorId,
          action: ModerationAction.DISABLE,
          reason,
          notes,
        },
      }),
    ]);

    this.events.emitModerationEvent({
      action: 'DISABLE',
      episodeId,
      animeId: episode.animeId,
      moderatorId,
      reason,
    });

    return updated;
  }

  async enable(
    episodeId: string,
    moderatorId: string,
    reason: string,
    notes?: string,
  ) {
    const episode = await this.findEpisode(episodeId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.episode.update({
        where: { id: episodeId },
        data: { isEnabled: true },
      }),
      this.prisma.moderationLog.create({
        data: {
          episodeId,
          animeId: episode.animeId,
          moderatorId,
          action: ModerationAction.RE_ENABLE,
          reason,
          notes,
        },
      }),
    ]);

    this.events.emitModerationEvent({
      action: 'RE_ENABLE',
      episodeId,
      animeId: episode.animeId,
      moderatorId,
      reason,
    });

    return updated;
  }

  private async findEpisode(episodeId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, animeId: true, episodeNumber: true },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }
    return episode;
  }
}
