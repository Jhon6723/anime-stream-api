import { Injectable } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [animeCount, episodeCount, pendingModeration, userCount] =
      await this.prisma.$transaction([
        this.prisma.anime.count(),
        this.prisma.episode.count(),
        this.prisma.episode.count({
          where: { moderationStatus: ModerationStatus.PENDING },
        }),
        this.prisma.user.count(),
      ]);
    return { animeCount, episodeCount, pendingModeration, userCount };
  }
}
