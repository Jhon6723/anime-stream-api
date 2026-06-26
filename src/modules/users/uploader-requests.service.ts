import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UploaderRequestStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UploaderRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.USER) {
      throw new BadRequestException(
        'Only users with role USER can request uploader status',
      );
    }

    const existing = await this.prisma.uploaderRequest.findFirst({
      where: { userId, status: UploaderRequestStatus.PENDING },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a pending uploader request',
      );
    }

    return this.prisma.uploaderRequest.create({
      data: { userId },
      include: {
        user: {
          select: { id: true, email: true, username: true, role: true },
        },
      },
    });
  }

  async findPending() {
    return this.prisma.uploaderRequest.findMany({
      where: { status: UploaderRequestStatus.PENDING },
      include: {
        user: {
          select: { id: true, email: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(requestId: string, adminId: string) {
    const request = await this.prisma.uploaderRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Uploader request not found');
    }
    if (request.status !== UploaderRequestStatus.PENDING) {
      throw new BadRequestException('Request has already been resolved');
    }

    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.uploaderRequest.update({
        where: { id: requestId },
        data: {
          status: UploaderRequestStatus.APPROVED,
          reviewedById: adminId,
        },
        include: {
          user: {
            select: { id: true, email: true, username: true, role: true },
          },
        },
      }),
      this.prisma.user.update({
        where: { id: request.userId },
        data: {
          role: UserRole.UPLOADER,
          approvedById: adminId,
        },
      }),
    ]);

    return updatedRequest;
  }

  async reject(requestId: string, adminId: string) {
    const request = await this.prisma.uploaderRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Uploader request not found');
    }
    if (request.status !== UploaderRequestStatus.PENDING) {
      throw new BadRequestException('Request has already been resolved');
    }

    return this.prisma.uploaderRequest.update({
      where: { id: requestId },
      data: {
        status: UploaderRequestStatus.REJECTED,
        reviewedById: adminId,
      },
      include: {
        user: {
          select: { id: true, email: true, username: true, role: true },
        },
      },
    });
  }
}
