import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly threshold: number;
  private readonly adminEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.threshold = parseInt(
      process.env.BROKEN_LINK_THRESHOLD ?? '3',
      10,
    );
    this.adminEmail = process.env.ADMIN_EMAIL ?? 'admin@animestream.local';
  }

  async reportBrokenLink(
    videoSourceId: string,
    ipAddress: string,
    userAgent?: string,
  ) {
    const videoSource = await this.prisma.videoSource.findUnique({
      where: { id: videoSourceId },
      select: { id: true, status: true, episode: { select: { anime: { select: { title: true } }, episodeNumber: true, title: true } } },
    });

    if (!videoSource) {
      throw new NotFoundException('Video source not found');
    }

    const report = await this.prisma.brokenLinkReport.create({
      data: {
        videoSourceId,
        ipAddress,
        userAgent,
      },
    });

    const reportCount = await this.prisma.brokenLinkReport.count({
      where: { videoSourceId },
    });

    if (reportCount >= this.threshold && videoSource.status !== VideoSourceStatus.ERROR) {
      await this.prisma.videoSource.update({
        where: { id: videoSourceId },
        data: { status: VideoSourceStatus.ERROR },
      });

      this.logger.warn(
        `VideoSource ${videoSourceId} auto-disabled after ${reportCount} broken link reports`,
      );

      this.notifyAdmin(videoSourceId, reportCount, videoSource.episode);
    } else {
      this.notifyAdmin(videoSourceId, reportCount, videoSource.episode);
    }

    return { id: report.id, reportCount, threshold: this.threshold };
  }

  private notifyAdmin(
    videoSourceId: string,
    reportCount: number,
    episode: { anime: { title: string }; episodeNumber: number; title: string | null } | null,
  ) {
    const animeTitle = episode?.anime?.title ?? 'Unknown';
    const episodeTitle = episode?.title ?? `Episode ${episode?.episodeNumber ?? '?'}`;

    this.logger.log(
      `[Broken Link Report] Anime: ${animeTitle}, Episode: ${episodeTitle}, ` +
      `VideoSource: ${videoSourceId}, Reports: ${reportCount}, ` +
      `Notify: ${this.adminEmail}`,
    );
  }

  async listBrokenLinks(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [reports, total] = await Promise.all([
      this.prisma.brokenLinkReport.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          videoSource: {
            select: {
              id: true,
              provider: true,
              status: true,
              episode: {
                select: {
                  id: true,
                  episodeNumber: true,
                  title: true,
                  anime: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.brokenLinkReport.count(),
    ]);

    return {
      items: reports,
      total,
      page,
      pageSize,
    };
  }
}
