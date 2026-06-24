import { Injectable } from '@nestjs/common';
import { AdPlacement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  activeByPlacement(placement: AdPlacement) {
    return this.prisma.adConfig.findMany({
      where: { placement, isActive: true },
    });
  }

  listAll() {
    return this.prisma.adConfig.findMany({ orderBy: { placement: 'asc' } });
  }
}
