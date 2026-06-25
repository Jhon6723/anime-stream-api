import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnimeStatus, AnimeType, ModerationStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface JikanSearchResult {
  malId: number;
  title: string;
  type?: string;
  episodes?: number;
  status?: string;
  synopsis?: string;
  imageUrl?: string;
}

export interface JikanAnimeDetail {
  malId: number;
  title: string;
  titleEnglish?: string;
  synopsis?: string;
  coverImage?: string;
  bannerImage?: string;
  status?: string;
  type?: string;
  genres: string[];
  studios: string[];
  totalEpisodes?: number;
  releaseDate?: string;
}

export interface JikanEpisode {
  malId: number;
  title: string;
  aired?: string;
  filler?: boolean;
}

interface JikanResponse<T> {
  data: T;
  pagination?: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

const CACHE_PREFIX = 'jikan:';

@Injectable()
export class JikanService {
  private readonly logger = new Logger(JikanService.name);
  private readonly baseUrl: string;
  private readonly cacheTtl: number;
  private readonly minIntervalMs: number;
  private lastRequestTime = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.config.get<string>('jikan.baseUrl') ?? 'https://api.jikan.moe/v4';
    this.cacheTtl = this.config.get<number>('jikan.cacheTtlSeconds') ?? 86400;
    const maxRps = this.config.get<number>('jikan.maxRequestsPerSecond') ?? 3;
    this.minIntervalMs = Math.ceil(1000 / maxRps);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async cachedGet<T>(path: string): Promise<JikanResponse<T>> {
    const cacheKey = `${CACHE_PREFIX}${path}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as JikanResponse<T>;
    }

    await this.throttle();

    try {
      const { data } = await firstValueFrom(
        this.http.get<JikanResponse<T>>(`${this.baseUrl}${path}`, {
          timeout: 10000,
        }),
      );

      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(data));
      return data;
    } catch (error: any) {
      if (error?.response?.status === 429) {
        this.logger.warn('Jikan rate limited (429), retrying after 1s');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.cachedGet<T>(path);
      }
      if (error?.response?.status === 404) {
        throw new NotFoundException('Jikan resource not found');
      }
      this.logger.error(`Jikan request failed: ${error?.message}`);
      throw new ServiceUnavailableException('Jikan API unavailable');
    }
  }

  async search(query: string, page = 1, limit = 10): Promise<{ items: JikanSearchResult[]; page: number; hasNext: boolean }> {
    if (!query || query.trim().length < 3) {
      throw new BadRequestException('Search query must be at least 3 characters');
    }

    const clampedLimit = Math.min(limit, 25);
    const response = await this.cachedGet<any[]>(
      `/anime?q=${encodeURIComponent(query)}&page=${page}&limit=${clampedLimit}&sfw=true`,
    );

    const items = (response.data ?? []).map((item: any) => ({
      malId: item.mal_id,
      title: item.title_english || item.title,
      type: item.type,
      episodes: item.episodes,
      status: item.status,
      synopsis: item.synopsis,
      imageUrl: item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url,
    }));

    return {
      items,
      page,
      hasNext: response.pagination?.has_next_page ?? false,
    };
  }

  async getSeasonNow(page = 1, limit = 15): Promise<{ items: JikanSearchResult[]; page: number; hasNext: boolean }> {
    const clampedLimit = Math.min(limit, 25);
    const response = await this.cachedGet<any[]>(`/seasons/now?page=${page}&limit=${clampedLimit}&sfw=true`);

    const items = (response.data ?? []).map((item: any) => ({
      malId: item.mal_id,
      title: item.title_english || item.title,
      type: item.type,
      episodes: item.episodes,
      status: item.status,
      synopsis: item.synopsis,
      imageUrl: item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url,
    }));

    return {
      items,
      page,
      hasNext: response.pagination?.has_next_page ?? false,
    };
  }

  async getAnimePreview(malId: number): Promise<JikanAnimeDetail> {
    const response = await this.cachedGet<any>(`/anime/${malId}/full`);
    const item = response.data;

    return {
      malId: item.mal_id,
      title: item.title_english || item.title,
      titleEnglish: item.title_english,
      synopsis: item.synopsis,
      coverImage: item.images?.jpg?.large_image_url,
      bannerImage: item.images?.webp?.large_image_url,
      status: item.status,
      type: item.type,
      genres: (item.genres ?? []).map((g: any) => g.name),
      studios: (item.studios ?? []).map((s: any) => s.name),
      totalEpisodes: item.episodes,
      releaseDate: item.aired?.from,
    };
  }

  async importAnime(
    malId: number,
    userId: string,
  ): Promise<{ animeId: string; episodeCount: number }> {
    const existing = await this.prisma.anime.findUnique({
      where: { jikanId: malId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Anime with Jikan ID ${malId} already imported`);
    }

    const detail = await this.getAnimePreview(malId);
    const slug = this.generateSlug(detail.title);

    const anime = await this.prisma.anime.create({
      data: {
        title: detail.title,
        slug,
        synopsis: detail.synopsis,
        coverImage: detail.coverImage,
        bannerImage: detail.bannerImage,
        status: this.mapStatus(detail.status),
        type: this.mapType(detail.type),
        genres: detail.genres,
        studios: detail.studios,
        totalEpisodes: detail.totalEpisodes,
        releaseDate: detail.releaseDate ? new Date(detail.releaseDate) : null,
        jikanId: malId,
        isTitleLocked: true,
        createdById: userId,
      },
    });

    const episodes = await this.fetchAllEpisodes(malId);

    if (episodes.length > 0) {
      await this.prisma.episode.createMany({
        data: episodes.map((ep) => ({
          animeId: anime.id,
          episodeNumber: ep.malId,
          title: ep.title,
          airedDate: ep.aired ? new Date(ep.aired) : null,
          isFiller: ep.filler ?? false,
          moderationStatus: ModerationStatus.PENDING,
          isEnabled: true,
          jikanEpisodeId: ep.malId,
          createdById: userId,
        })),
      });
    }

    return { animeId: anime.id, episodeCount: episodes.length };
  }

  private async fetchAllEpisodes(malId: number): Promise<JikanEpisode[]> {
    const allEpisodes: JikanEpisode[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response = await this.cachedGet<any[]>(
        `/anime/${malId}/episodes?page=${page}`,
      );

      for (const ep of response.data ?? []) {
        allEpisodes.push({
          malId: ep.mal_id,
          title: ep.title ?? `Episode ${ep.mal_id}`,
          aired: ep.aired,
          filler: ep.filler ?? false,
        });
      }

      hasNext = response.pagination?.has_next_page ?? false;
      page++;

      if (page > 50) break;
    }

    return allEpisodes;
  }

  private mapStatus(jikanStatus?: string): AnimeStatus {
    switch (jikanStatus) {
      case 'Currently Airing':
        return AnimeStatus.ONGOING;
      case 'Finished Airing':
        return AnimeStatus.COMPLETED;
      case 'Not yet aired':
        return AnimeStatus.UPCOMING;
      default:
        return AnimeStatus.ONGOING;
    }
  }

  private mapType(jikanType?: string): AnimeType {
    switch (jikanType) {
      case 'TV':
        return AnimeType.TV;
      case 'Movie':
        return AnimeType.MOVIE;
      case 'OVA':
        return AnimeType.OVA;
      case 'ONA':
        return AnimeType.ONA;
      case 'Special':
        return AnimeType.SPECIAL;
      default:
        return AnimeType.TV;
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }
}
