import { Injectable, NotFoundException } from '@nestjs/common';
import { ModerationAction, SubtitleLanguage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { UpdateVideoSourceDto } from './dto/update-video-source.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      activeAnimes,
      pendingUploads,
      totalUsers,
      pendingModeration,
      totalEpisodes,
      totalVideoSources,
    ] = await Promise.all([
      this.prisma.anime.count({ where: { isEnabled: true } }),
      this.prisma.uploadJob.count({
        where: { status: { in: ['QUEUED', 'UPLOADING', 'PROCESSING'] } },
      }),
      this.prisma.user.count(),
      this.prisma.episode.count({ where: { moderationStatus: 'PENDING' } }),
      this.prisma.episode.count(),
      this.prisma.videoSource.count(),
    ]);

    return {
      activeAnimes,
      pendingUploads,
      totalUsers,
      pendingModeration,
      totalEpisodes,
      totalVideoSources,
    };
  }

  async hardDeleteAnime(animeId: string, adminId: string, reason: string) {
    const anime = await this.prisma.anime.findUnique({
      where: { id: animeId },
      select: { id: true, title: true },
    });
    if (!anime) {
      throw new NotFoundException(`Anime ${animeId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.moderationLog.create({
        data: {
          animeId,
          moderatorId: adminId,
          action: ModerationAction.HARD_DELETE,
          reason,
        },
      }),
      this.prisma.anime.delete({ where: { id: animeId } }),
    ]);

    return { id: animeId, title: anime.title, deleted: true };
  }

  async hardDeleteEpisode(episodeId: string, adminId: string, reason: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, episodeNumber: true, animeId: true },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.moderationLog.create({
        data: {
          animeId: episode.animeId,
          episodeId,
          moderatorId: adminId,
          action: ModerationAction.HARD_DELETE,
          reason,
        },
      }),
      this.prisma.episode.delete({ where: { id: episodeId } }),
    ]);

    return {
      id: episodeId,
      episodeNumber: episode.episodeNumber,
      deleted: true,
    };
  }

  async hardDeleteVideoSource(
    videoSourceId: string,
    adminId: string,
    reason: string,
  ) {
    const source = await this.prisma.videoSource.findUnique({
      where: { id: videoSourceId },
      select: { id: true, provider: true, episodeId: true },
    });
    if (!source) {
      throw new NotFoundException(`VideoSource ${videoSourceId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.moderationLog.create({
        data: {
          animeId: (
            await this.prisma.episode.findUnique({
              where: { id: source.episodeId },
              select: { animeId: true },
            })
          )?.animeId,
          episodeId: source.episodeId,
          moderatorId: adminId,
          action: ModerationAction.HARD_DELETE,
          reason,
        },
      }),
      this.prisma.videoSource.delete({ where: { id: videoSourceId } }),
    ]);

    return { id: videoSourceId, provider: source.provider, deleted: true };
  }

  async updateEpisode(episodeId: string, dto: UpdateEpisodeDto) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true },
    });
    if (!episode) {
      throw new NotFoundException(`Episode ${episodeId} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title || null;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.episodeNumber !== undefined) data.episodeNumber = dto.episodeNumber;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.isFiller !== undefined) data.isFiller = dto.isFiller;

    return this.prisma.episode.update({
      where: { id: episodeId },
      data,
      select: {
        id: true,
        episodeNumber: true,
        title: true,
        description: true,
        isEnabled: true,
        isFiller: true,
        updatedAt: true,
      },
    });
  }

  async updateVideoSource(videoSourceId: string, dto: UpdateVideoSourceDto) {
    const source = await this.prisma.videoSource.findUnique({
      where: { id: videoSourceId },
      select: { id: true },
    });
    if (!source) {
      throw new NotFoundException(`VideoSource ${videoSourceId} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.language !== undefined) data.language = dto.language as SubtitleLanguage;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.embedUrl !== undefined) data.embedUrl = dto.embedUrl || null;

    return this.prisma.videoSource.update({
      where: { id: videoSourceId },
      data,
      select: {
        id: true,
        provider: true,
        language: true,
        embedUrl: true,
        isActive: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}
