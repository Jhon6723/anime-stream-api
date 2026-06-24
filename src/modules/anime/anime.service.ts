import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CatalogQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

  async findCatalog(query: CatalogQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 24, 100);
    const where: Prisma.AnimeWhereInput = {
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.anime.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.anime.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findBySlug(slug: string) {
    const anime = await this.prisma.anime.findUnique({
      where: { slug },
      include: { episodes: { orderBy: { episodeNumber: 'asc' } } },
    });
    if (!anime) {
      throw new NotFoundException('Anime not found');
    }
    return anime;
  }
}
