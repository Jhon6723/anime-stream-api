import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationStatus } from '@prisma/client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JikanService } from './jikan.service';

const mockJikanSearchResponse = {
  data: [
    {
      mal_id: 20,
      title: 'Naruto',
      title_english: 'Naruto',
      type: 'TV',
      episodes: 220,
      status: 'Finished Airing',
      synopsis: 'A ninja story',
      images: {
        jpg: { large_image_url: 'https://example.com/naruto.jpg' },
        webp: { large_image_url: 'https://example.com/naruto.webp' },
      },
    },
  ],
  pagination: { last_visible_page: 1, has_next_page: false },
};

const mockJikanAnimeFull = {
  data: {
    mal_id: 20,
    title: 'Naruto',
    title_english: 'Naruto',
    synopsis: 'A ninja story',
    status: 'Finished Airing',
    type: 'TV',
    episodes: 220,
    aired: { from: '2002-10-03T00:00:00+00:00' },
    genres: [{ name: 'Action' }, { name: 'Adventure' }],
    studios: [{ name: 'Studio Pierrot' }],
    images: {
      jpg: { large_image_url: 'https://example.com/naruto.jpg' },
      webp: { large_image_url: 'https://example.com/naruto.webp' },
    },
  },
};

const mockEpisodesPage1 = {
  data: [
    {
      mal_id: 1,
      title: 'Enter: Naruto Uzumaki!',
      aired: '2002-10-03T00:00:00+00:00',
      filler: false,
    },
    {
      mal_id: 2,
      title: 'My Name is Konohamaru!',
      aired: '2002-10-10T00:00:00+00:00',
      filler: false,
    },
  ],
  pagination: { last_visible_page: 2, has_next_page: true },
};

const mockEpisodesPage2 = {
  data: [
    {
      mal_id: 3,
      title: 'Sasuke and Sakura',
      aired: '2002-10-17T00:00:00+00:00',
      filler: false,
    },
  ],
  pagination: { last_visible_page: 2, has_next_page: false },
};

describe('JikanService', () => {
  let service: JikanService;
  let httpService: { get: ReturnType<typeof vi.fn> };
  let redis: { get: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn> };
  let prisma: {
    anime: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    episode: { createMany: ReturnType<typeof vi.fn> };
  };
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    httpService = { get: vi.fn() };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue(undefined),
    };
    prisma = {
      anime: { findUnique: vi.fn(), create: vi.fn() },
      episode: { createMany: vi.fn() },
    };
    config = {
      get: vi.fn((key: string) => {
        if (key === 'jikan.baseUrl') return 'https://api.jikan.moe/v4';
        if (key === 'jikan.cacheTtlSeconds') return 86400;
        if (key === 'jikan.maxRequestsPerSecond') return 3;
        return undefined;
      }),
    };

    service = new JikanService(
      httpService as unknown as HttpService,
      config as unknown as ConfigService,
      redis as unknown as RedisService,
      prisma as unknown as PrismaService,
    );
  });

  describe('search', () => {
    it('returns mapped search results', async () => {
      httpService.get.mockReturnValue(of({ data: mockJikanSearchResponse }));

      const result = await service.search('naruto');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].malId).toBe(20);
      expect(result.items[0].title).toBe('Naruto');
      expect(result.items[0].imageUrl).toBe('https://example.com/naruto.jpg');
      expect(result.hasNext).toBe(false);
    });

    it('throws BadRequestException for short query', async () => {
      await expect(service.search('ab')).rejects.toThrow(BadRequestException);
    });

    it('returns cached results without HTTP call', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockJikanSearchResponse));

      const result = await service.search('naruto');

      expect(result.items).toHaveLength(1);
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });

  describe('getSeasonNow', () => {
    it('returns current season anime', async () => {
      httpService.get.mockReturnValue(of({ data: mockJikanSearchResponse }));

      const result = await service.getSeasonNow();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].malId).toBe(20);
    });
  });

  describe('getAnimePreview', () => {
    it('returns mapped anime detail', async () => {
      httpService.get.mockReturnValue(of({ data: mockJikanAnimeFull }));

      const detail = await service.getAnimePreview(20);

      expect(detail.malId).toBe(20);
      expect(detail.title).toBe('Naruto');
      expect(detail.genres).toEqual(['Action', 'Adventure']);
      expect(detail.studios).toEqual(['Studio Pierrot']);
      expect(detail.coverImage).toBe('https://example.com/naruto.jpg');
      expect(detail.bannerImage).toBe('https://example.com/naruto.webp');
    });

    it('throws NotFoundException on 404', async () => {
      httpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 404 } })),
      );

      await expect(service.getAnimePreview(99999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      httpService.get.mockReturnValue(
        throwError(() => ({ message: 'ECONNREFUSED' })),
      );

      await expect(service.getAnimePreview(20)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('importAnime', () => {
    it('creates anime and episodes from Jikan data', async () => {
      prisma.anime.findUnique.mockResolvedValue(null);
      prisma.anime.create.mockResolvedValue({ id: 'anime-1' });

      // First call: anime full, then episodes page 1, then episodes page 2
      httpService.get
        .mockReturnValueOnce(of({ data: mockJikanAnimeFull }))
        .mockReturnValueOnce(of({ data: mockEpisodesPage1 }))
        .mockReturnValueOnce(of({ data: mockEpisodesPage2 }));

      const result = await service.importAnime(20, 'user-1');

      expect(result.animeId).toBe('anime-1');
      expect(result.episodeCount).toBe(3);
      expect(prisma.anime.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jikanId: 20,
            isTitleLocked: true,
            title: 'Naruto',
            slug: 'naruto',
            createdById: 'user-1',
          }),
        }),
      );
      expect(prisma.episode.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              animeId: 'anime-1',
              episodeNumber: 1,
              moderationStatus: ModerationStatus.PENDING,
              createdById: 'user-1',
            }) as unknown as Record<string, unknown>,
          ]),
        }),
      );
    });

    it('throws ConflictException when anime already imported', async () => {
      prisma.anime.findUnique.mockResolvedValue({ id: 'existing-1' });

      await expect(service.importAnime(20, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates anime with no episodes if Jikan has none', async () => {
      prisma.anime.findUnique.mockResolvedValue(null);
      prisma.anime.create.mockResolvedValue({ id: 'anime-2' });
      httpService.get
        .mockReturnValueOnce(of({ data: mockJikanAnimeFull }))
        .mockReturnValueOnce(
          of({ data: { data: [], pagination: { has_next_page: false } } }),
        );

      const result = await service.importAnime(20, 'user-1');

      expect(result.episodeCount).toBe(0);
      expect(prisma.episode.createMany).not.toHaveBeenCalled();
    });
  });
});
