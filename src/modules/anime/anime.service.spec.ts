import { NotFoundException } from '@nestjs/common';
import { ModerationStatus, Prisma, VideoSourceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoSourceSyncService } from '../upload/video-source-sync.service';
import { AnimeService } from './anime.service';

const mockAnime = {
  id: 'anime-1',
  title: 'Naruto',
  slug: 'naruto',
  synopsis: 'A ninja story',
  coverImage: 'https://example.com/cover.jpg',
  bannerImage: 'https://example.com/banner.jpg',
  status: 'ONGOING',
  type: 'TV',
  genres: ['Action', 'Adventure'],
  studios: ['Studio Pierrot'],
  totalEpisodes: 220,
  releaseDate: new Date('2002-10-03'),
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEpisode = {
  id: 'ep-1',
  animeId: 'anime-1',
  episodeNumber: 1,
  title: 'Episode 1',
  description: 'The beginning',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: 24,
  isEnabled: true,
  moderationStatus: ModerationStatus.APPROVED,
  isFiller: false,
  airedDate: new Date('2002-10-03'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVideoSources = [
  { id: 'vs-1', provider: 'DOODSTREAM', embedUrl: 'https://dood.so/embed/abc' },
  { id: 'vs-2', provider: 'MIXDROP', embedUrl: 'https://mixdrop.to/embed/def' },
];

describe('AnimeService', () => {
  let service: AnimeService;
  let prisma: {
    anime: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    episode: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      anime: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      episode: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const syncService = { syncPendingSources: vi.fn() };
    service = new AnimeService(
      prisma as unknown as PrismaService,
      syncService as unknown as VideoSourceSyncService,
    );
  });

  describe('findCatalog', () => {
    it('returns paginated catalog with default params', async () => {
      prisma.$transaction.mockResolvedValue([[mockAnime], 1]);

      const result = await service.findCatalog({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(24);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('filters by search query (q)', async () => {
      prisma.anime.findMany.mockReturnValue(Promise.resolve([mockAnime]));
      prisma.anime.count.mockReturnValue(Promise.resolve(1));
      prisma.$transaction.mockResolvedValue([[mockAnime], 1]);

      await service.findCatalog({ q: 'naruto' });

      expect(prisma.anime.findMany).toHaveBeenCalled();
      const findManyArg = prisma.anime.findMany.mock
        .calls[0][0] as Prisma.AnimeFindManyArgs;
      expect(findManyArg.where?.title).toEqual({
        contains: 'naruto',
        mode: 'insensitive',
      });
    });

    it('filters by genre', async () => {
      prisma.$transaction.mockResolvedValue([[mockAnime], 1]);

      await service.findCatalog({ genre: 'Action' });

      const findManyArg = prisma.anime.findMany.mock
        .calls[0][0] as Prisma.AnimeFindManyArgs;
      expect(findManyArg.where?.genres).toEqual({ has: 'Action' });
    });

    it('filters by status', async () => {
      prisma.$transaction.mockResolvedValue([[mockAnime], 1]);

      await service.findCatalog({ status: 'ONGOING' });

      const findManyArg = prisma.anime.findMany.mock
        .calls[0][0] as Prisma.AnimeFindManyArgs;
      expect(findManyArg.where?.status).toBe('ONGOING');
    });

    it('filters by type', async () => {
      prisma.$transaction.mockResolvedValue([[mockAnime], 1]);

      await service.findCatalog({ type: 'TV' });

      const findManyArg = prisma.anime.findMany.mock
        .calls[0][0] as Prisma.AnimeFindManyArgs;
      expect(findManyArg.where?.type).toBe('TV');
    });

    it('always filters isEnabled = true', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await service.findCatalog({});

      const findManyArg = prisma.anime.findMany.mock
        .calls[0][0] as Prisma.AnimeFindManyArgs;
      expect(findManyArg.where?.isEnabled).toBe(true);
    });

    it('caps pageSize at 100', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findCatalog({ pageSize: 500 });

      expect(result.pageSize).toBe(100);
    });
  });

  describe('findBySlug', () => {
    it('returns anime with approved episodes', async () => {
      prisma.anime.findFirst.mockResolvedValue({
        ...mockAnime,
        episodes: [mockEpisode],
      });

      const result = await service.findBySlug('naruto');

      expect(result.title).toBe('Naruto');
      expect(result.episodes).toHaveLength(1);
      expect(prisma.anime.findFirst).toHaveBeenCalledWith({
        where: { slug: 'naruto', isEnabled: true },
        include: expect.objectContaining({
          episodes: expect.objectContaining({
            where: {
              isEnabled: true,
              moderationStatus: ModerationStatus.APPROVED,
            },
          }),
        }),
      });
    });

    it('throws NotFoundException when anime not found', async () => {
      prisma.anime.findFirst.mockResolvedValue(null);

      await expect(service.findBySlug('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findEpisode', () => {
    it('returns episode with video sources and nav', async () => {
      prisma.anime.findFirst.mockResolvedValue({
        id: 'anime-1',
        title: 'Naruto',
        slug: 'naruto',
        coverImage: 'https://example.com/cover.jpg',
        bannerImage: 'https://example.com/banner.jpg',
      });
      prisma.episode.findFirst
        .mockResolvedValueOnce({
          ...mockEpisode,
          videoSources: mockVideoSources,
        })
        .mockResolvedValueOnce(null) // prev (episode 0 doesn't exist)
        .mockResolvedValueOnce({ episodeNumber: 2, title: 'Episode 2' }); // next

      const result = await service.findEpisode('naruto', 1);

      expect(result.anime.slug).toBe('naruto');
      expect(result.episode.episodeNumber).toBe(1);
      expect(result.episode.videoSources).toHaveLength(2);
      expect(result.prevEpisode).toBeNull();
      expect(result.nextEpisode!.episodeNumber).toBe(2);
    });

    it('filters video sources by isActive and status READY', async () => {
      prisma.anime.findFirst.mockResolvedValue({
        id: 'anime-1',
        title: 'Naruto',
        slug: 'naruto',
        coverImage: null,
        bannerImage: null,
      });
      prisma.episode.findFirst
        .mockResolvedValueOnce({ ...mockEpisode, videoSources: [] })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.findEpisode('naruto', 1);

      const episodeCall = prisma.episode.findFirst.mock.calls[0][0] as {
        include?: { videoSources?: { where?: unknown } };
      };
      expect(episodeCall.include?.videoSources?.where).toEqual({
        isActive: true,
        status: VideoSourceStatus.READY,
      });
    });

    it('throws NotFoundException when anime not found', async () => {
      prisma.anime.findFirst.mockResolvedValue(null);

      await expect(service.findEpisode('nope', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when episode not found', async () => {
      prisma.anime.findFirst.mockResolvedValue({
        id: 'anime-1',
        title: 'Naruto',
        slug: 'naruto',
        coverImage: null,
        bannerImage: null,
      });
      prisma.episode.findFirst.mockResolvedValue(null);

      await expect(service.findEpisode('naruto', 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findHome', () => {
    it('returns featured, trending, and recent episodes', async () => {
      prisma.$transaction.mockResolvedValue([
        mockAnime, // featured
        [mockAnime], // trending
        [
          {
            ...mockEpisode,
            anime: {
              id: 'anime-1',
              title: 'Naruto',
              slug: 'naruto',
              coverImage: null,
            },
          },
        ], // recentEpisodes
      ]);

      const result = await service.findHome();

      expect(result.featured!.title).toBe('Naruto');
      expect(result.trending).toHaveLength(1);
      expect(result.recentEpisodes).toHaveLength(1);
    });

    it('returns null featured when no anime exists', async () => {
      prisma.$transaction.mockResolvedValue([null, [], []]);

      const result = await service.findHome();

      expect(result.featured).toBeNull();
      expect(result.trending).toEqual([]);
      expect(result.recentEpisodes).toEqual([]);
    });
  });
});
