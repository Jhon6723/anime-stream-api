import { NotFoundException } from '@nestjs/common';
import {
    ModerationAction,
    ModerationStatus,
    VideoSourceStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../websocket/events.gateway';
import { VideoSourceSyncService } from '../upload/video-source-sync.service';
import { ModerationService } from './moderation.service';

type MockedPrisma = {
  episode: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  videoSource: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  moderationLog: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: MockedPrisma;
  let events: { emitModerationEvent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      episode: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      videoSource: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      moderationLog: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((arr) => Promise.all(arr)),
    };
    events = {
      emitModerationEvent: vi.fn(),
    };
    service = new ModerationService(
      prisma as unknown as PrismaService,
      events as unknown as EventsGateway,
      { syncPendingSources: vi.fn() } as unknown as VideoSourceSyncService,
    );
  });

  describe('pendingQueue', () => {
    it('returns paginated episodes with PENDING status', async () => {
      prisma.episode.findMany.mockResolvedValue([
        {
          id: 'ep-1',
          moderationStatus: 'PENDING',
          anime: { title: 'Naruto', slug: 'naruto' },
          videoSources: [
            { id: 'vs-1', provider: 'STREAMTAPE', status: 'READY' },
          ],
        },
      ]);
      prisma.episode.count.mockResolvedValue(1);

      const result = await service.pendingQueue(1, 24);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].hasVideo).toBe(true);
      expect(result.items[0].providers).toEqual(['STREAMTAPE']);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(24);
      expect(result.totalPages).toBe(1);
      expect(prisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            moderationStatus: ModerationStatus.PENDING,
            videoSources: {
              some: {
                status: {
                  notIn: [VideoSourceStatus.DELETED, VideoSourceStatus.ERROR],
                },
              },
            },
          },
          skip: 0,
          take: 24,
        }),
      );
    });

    it('calculates pagination correctly for multiple pages', async () => {
      prisma.episode.findMany.mockResolvedValue([]);
      prisma.episode.count.mockResolvedValue(50);

      const result = await service.pendingQueue(2, 24);

      expect(result.totalPages).toBe(3);
      expect(prisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 24, take: 24 }),
      );
    });
  });

  describe('auditLog', () => {
    it('returns logs with includes', async () => {
      prisma.moderationLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'APPROVE',
          moderator: { id: 'u-1', username: 'admin' },
        },
      ]);

      const result = await service.auditLog();

      expect(result).toHaveLength(1);
      expect(prisma.moderationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );
    });

    it('filters by episodeId when provided', async () => {
      prisma.moderationLog.findMany.mockResolvedValue([]);

      await service.auditLog('ep-1');

      expect(prisma.moderationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { episodeId: 'ep-1' },
        }),
      );
    });
  });

  describe('approve', () => {
    it('updates episode to APPROVED and creates log', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        animeId: 'anime-1',
        episodeNumber: 1,
      });
      prisma.episode.update.mockResolvedValue({
        id: 'ep-1',
        moderationStatus: 'APPROVED',
      });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.approve('ep-1', 'mod-1', 'Video correcto');

      expect(result.moderationStatus).toBe('APPROVED');
      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { moderationStatus: ModerationStatus.APPROVED },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.APPROVE,
          reason: 'Video correcto',
          notes: undefined,
        },
      });
      expect(events.emitModerationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPROVE', episodeId: 'ep-1' }),
      );
    });

    it('throws NotFoundException when episode does not exist', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        service.approve('nonexistent', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('warn', () => {
    it('updates episode to WARNED and creates log', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        animeId: 'anime-1',
        episodeNumber: 1,
      });
      prisma.episode.update.mockResolvedValue({
        id: 'ep-1',
        moderationStatus: 'WARNED',
      });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.warn(
        'ep-1',
        'mod-1',
        'Wrong video',
        'Check timestamp',
      );

      expect(result.moderationStatus).toBe('WARNED');
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.WARNING,
          reason: 'Wrong video',
          notes: 'Check timestamp',
        },
      });
      expect(events.emitModerationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WARNING', episodeId: 'ep-1' }),
      );
    });
  });

  describe('disable', () => {
    it('sets isEnabled to false and creates log', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        animeId: 'anime-1',
        episodeNumber: 1,
      });
      prisma.episode.update.mockResolvedValue({ id: 'ep-1', isEnabled: false });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.disable(
        'ep-1',
        'mod-1',
        'Inappropriate content',
      );

      expect(result.isEnabled).toBe(false);
      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { isEnabled: false },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.DISABLE,
          reason: 'Inappropriate content',
          notes: undefined,
        },
      });
      expect(events.emitModerationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISABLE', episodeId: 'ep-1' }),
      );
    });
  });

  describe('enable', () => {
    it('sets isEnabled to true and creates log', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        animeId: 'anime-1',
        episodeNumber: 1,
      });
      prisma.episode.update.mockResolvedValue({ id: 'ep-1', isEnabled: true });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.enable(
        'ep-1',
        'mod-1',
        'Re-enabled after review',
      );

      expect(result.isEnabled).toBe(true);
      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { isEnabled: true },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.RE_ENABLE,
          reason: 'Re-enabled after review',
          notes: undefined,
        },
      });
      expect(events.emitModerationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RE_ENABLE', episodeId: 'ep-1' }),
      );
    });
  });

  describe('disableVideoSource', () => {
    it('sets isActive to false and creates log', async () => {
      prisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs-1',
        episodeId: 'ep-1',
        episode: { animeId: 'anime-1' },
      });
      prisma.videoSource.update.mockResolvedValue({
        id: 'vs-1',
        isActive: false,
      });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.disableVideoSource(
        'vs-1',
        'mod-1',
        'Contenido no relacionado',
      );

      expect(result.isActive).toBe(false);
      expect(prisma.videoSource.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: { isActive: false },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.DISABLE,
          reason: 'Contenido no relacionado',
          notes: undefined,
        },
      });
    });

    it('throws NotFoundException for non-existent videoSource', async () => {
      prisma.videoSource.findUnique.mockResolvedValue(null);

      await expect(
        service.disableVideoSource('nope', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('enableVideoSource', () => {
    it('sets isActive to true and creates log', async () => {
      prisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs-1',
        episodeId: 'ep-1',
        episode: { animeId: 'anime-1' },
      });
      prisma.videoSource.update.mockResolvedValue({
        id: 'vs-1',
        isActive: true,
      });
      prisma.moderationLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.enableVideoSource(
        'vs-1',
        'mod-1',
        'Re-enabled after review',
      );

      expect(result.isActive).toBe(true);
      expect(prisma.videoSource.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: { isActive: true },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: {
          episodeId: 'ep-1',
          animeId: 'anime-1',
          moderatorId: 'mod-1',
          action: ModerationAction.RE_ENABLE,
          reason: 'Re-enabled after review',
          notes: undefined,
        },
      });
    });

    it('throws NotFoundException for non-existent videoSource', async () => {
      prisma.videoSource.findUnique.mockResolvedValue(null);

      await expect(
        service.enableVideoSource('nope', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEpisode', () => {
    it('throws NotFoundException for non-existent episode', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        service.warn('nonexistent', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.disable('nonexistent', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.enable('nonexistent', 'mod-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
