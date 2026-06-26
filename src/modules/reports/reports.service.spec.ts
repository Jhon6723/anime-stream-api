import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoSourceStatus } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    videoSource: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    brokenLinkReport: {
      create: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      videoSource: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      brokenLinkReport: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    config = { get: vi.fn() };

    service = new ReportsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  describe('reportBrokenLink', () => {
    it('creates a report and returns count', async () => {
      prisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs-1',
        status: VideoSourceStatus.READY,
        episode: {
          anime: { title: 'Naruto' },
          episodeNumber: 1,
          title: 'Ep 1',
        },
      });
      prisma.brokenLinkReport.create.mockResolvedValue({ id: 'report-1' });
      prisma.brokenLinkReport.count.mockResolvedValue(1);

      const result = await service.reportBrokenLink(
        'vs-1',
        '127.0.0.1',
        'Mozilla',
      );

      expect(result.id).toBe('report-1');
      expect(result.reportCount).toBe(1);
      expect(result.threshold).toBe(3);
      expect(prisma.videoSource.update).not.toHaveBeenCalled();
    });

    it('auto-disables video source when threshold reached', async () => {
      prisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs-1',
        status: VideoSourceStatus.READY,
        episode: {
          anime: { title: 'Naruto' },
          episodeNumber: 1,
          title: 'Ep 1',
        },
      });
      prisma.brokenLinkReport.create.mockResolvedValue({ id: 'report-3' });
      prisma.brokenLinkReport.count.mockResolvedValue(3);

      await service.reportBrokenLink('vs-1', '127.0.0.1');

      expect(prisma.videoSource.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: { status: VideoSourceStatus.ERROR },
      });
    });

    it('does not auto-disable if already ERROR', async () => {
      prisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs-1',
        status: VideoSourceStatus.ERROR,
        episode: {
          anime: { title: 'Naruto' },
          episodeNumber: 1,
          title: 'Ep 1',
        },
      });
      prisma.brokenLinkReport.create.mockResolvedValue({ id: 'report-5' });
      prisma.brokenLinkReport.count.mockResolvedValue(5);

      await service.reportBrokenLink('vs-1', '127.0.0.1');

      expect(prisma.videoSource.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if video source does not exist', async () => {
      prisma.videoSource.findUnique.mockResolvedValue(null);

      await expect(
        service.reportBrokenLink('nonexistent', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listBrokenLinks', () => {
    it('returns paginated reports with video source info', async () => {
      prisma.brokenLinkReport.findMany.mockResolvedValue([
        {
          id: 'report-1',
          videoSourceId: 'vs-1',
          ipAddress: '127.0.0.1',
          videoSource: {
            id: 'vs-1',
            provider: 'DOODSTREAM',
            status: 'READY',
            episode: {
              id: 'ep-1',
              episodeNumber: 1,
              title: 'Ep 1',
              anime: { id: 'a-1', title: 'Naruto', slug: 'naruto' },
            },
          },
        },
      ]);
      prisma.brokenLinkReport.count.mockResolvedValue(1);

      const result = await service.listBrokenLinks(1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });
});
