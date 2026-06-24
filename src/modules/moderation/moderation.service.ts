import { Injectable } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  pendingQueue() {
    return this.prisma.episode.findMany({
      where: { moderationStatus: ModerationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { anime: { select: { title: true, slug: true } } },
    });
  }

  auditLog() {
    return this.prisma.moderationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
