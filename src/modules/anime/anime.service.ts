import { Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, Prisma, VideoSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CatalogQuery {
  q?: string;
  genre?: string;
  status?: string;
  type?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

type SortOption = 'recent' | 'most_viewed' | 'top_rated';

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

  async findCatalog(query: CatalogQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 24, 100);
    const sort: SortOption = (query.sort as SortOption) ?? 'recent';

    const where: Prisma.AnimeWhereInput = {
      isEnabled: true,
      ...(query.q
        ? { title: { contains: query.q, mode: 'insensitive' } }
        : {}),
      ...(query.genre ? { genres: { has: query.genre } } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.type ? { type: query.type as any } : {}),
    };

    let orderBy: Prisma.AnimeOrderByWithRelationInput;
    if (sort === 'most_viewed') {
      orderBy = { episodes: { _count: 'desc' } };
    } else if (sort === 'top_rated') {
      orderBy = { updatedAt: 'desc' };
    } else {
      orderBy = { updatedAt: 'desc' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.anime.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          synopsis: true,
          coverImage: true,
          bannerImage: true,
          status: true,
          type: true,
          genres: true,
          studios: true,
          totalEpisodes: true,
          releaseDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.anime.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findBySlug(slug: string) {
    const anime = await this.prisma.anime.findFirst({
      where: { slug, isEnabled: true },
      include: {
        episodes: {
          where: {
            isEnabled: true,
            moderationStatus: ModerationStatus.APPROVED,
          },
          orderBy: { episodeNumber: 'asc' },
          select: {
            id: true,
            episodeNumber: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            duration: true,
            isFiller: true,
            airedDate: true,
          },
        },
      },
    });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }
    return anime;
  }

  async findEpisode(slug: string, episodeNumber: number) {
    const anime = await this.prisma.anime.findFirst({
      where: { slug, isEnabled: true },
      select: { id: true, title: true, slug: true, coverImage: true, bannerImage: true },
    });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }

    const episode = await this.prisma.episode.findFirst({
      where: {
        animeId: anime.id,
        episodeNumber,
        isEnabled: true,
        moderationStatus: ModerationStatus.APPROVED,
      },
      include: {
        videoSources: {
          where: {
            isActive: true,
            status: VideoSourceStatus.READY,
          },
          select: {
            id: true,
            provider: true,
            embedUrl: true,
          },
          orderBy: { provider: 'asc' },
        },
      },
    });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    const [prevEpisode, nextEpisode] = await Promise.all([
      this.prisma.episode.findFirst({
        where: {
          animeId: anime.id,
          episodeNumber: episodeNumber - 1,
          isEnabled: true,
          moderationStatus: ModerationStatus.APPROVED,
        },
        select: { episodeNumber: true, title: true },
      }),
      this.prisma.episode.findFirst({
        where: {
          animeId: anime.id,
          episodeNumber: episodeNumber + 1,
          isEnabled: true,
          moderationStatus: ModerationStatus.APPROVED,
        },
        select: { episodeNumber: true, title: true },
      }),
    ]);

    return {
      anime,
      episode: {
        id: episode.id,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        description: episode.description,
        thumbnailUrl: episode.thumbnailUrl,
        duration: episode.duration,
        isFiller: episode.isFiller,
        airedDate: episode.airedDate,
        videoSources: episode.videoSources,
      },
      prevEpisode,
      nextEpisode,
    };
  }

  async findHome() {
    const [featured, trending, recentEpisodes] = await this.prisma.$transaction([
      this.prisma.anime.findFirst({
        where: { isEnabled: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          synopsis: true,
          coverImage: true,
          bannerImage: true,
          status: true,
          type: true,
          genres: true,
          studios: true,
        },
      }),
      this.prisma.anime.findMany({
        where: { isEnabled: true },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          status: true,
          type: true,
          genres: true,
        },
      }),
      this.prisma.episode.findMany({
        where: {
          isEnabled: true,
          moderationStatus: ModerationStatus.APPROVED,
          anime: { isEnabled: true },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          anime: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
            },
          },
        },
      }),
    ]);

    return { featured, trending, recentEpisodes };
  }
}
