import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UploaderRequestStatus, UserRole } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UploaderRequestsService } from './uploader-requests.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  role: UserRole.USER,
};

const mockRequest = {
  id: 'req-1',
  userId: 'user-1',
  status: UploaderRequestStatus.PENDING,
  reviewedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: mockUser,
};

describe('UploaderRequestsService', () => {
  let service: UploaderRequestsService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    uploaderRequest: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      uploaderRequest: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    service = new UploaderRequestsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a pending uploader request for a USER', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.uploaderRequest.findFirst.mockResolvedValue(null);
      prisma.uploaderRequest.create.mockResolvedValue(mockRequest);

      const result = await service.create('user-1');

      expect(result.status).toBe(UploaderRequestStatus.PENDING);
      expect(prisma.uploaderRequest.create).toHaveBeenCalledOnce();
    });

    it('throws BadRequestException if user is not USER role', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: UserRole.UPLOADER });

      await expect(service.create('user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if pending request already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.uploaderRequest.findFirst.mockResolvedValue(mockRequest);

      await expect(service.create('user-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPending', () => {
    it('returns pending requests ordered by createdAt', async () => {
      prisma.uploaderRequest.findMany.mockResolvedValue([mockRequest]);

      const result = await service.findPending();

      expect(result).toHaveLength(1);
      expect(prisma.uploaderRequest.findMany).toHaveBeenCalledWith({
        where: { status: UploaderRequestStatus.PENDING },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('approve', () => {
    it('approves request and upgrades user to UPLOADER', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue(mockRequest);
      const approvedRequest = { ...mockRequest, status: UploaderRequestStatus.APPROVED, reviewedById: 'admin-1' };
      prisma.$transaction.mockResolvedValue([approvedRequest]);

      const result = await service.approve('req-1', 'admin-1');

      expect(result.status).toBe(UploaderRequestStatus.APPROVED);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('throws BadRequestException if request is already resolved', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: UploaderRequestStatus.APPROVED,
      });

      await expect(service.approve('req-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if request does not exist', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue(null);

      await expect(service.approve('nope', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('rejects request and sets reviewedById', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue(mockRequest);
      const rejectedRequest = { ...mockRequest, status: UploaderRequestStatus.REJECTED, reviewedById: 'admin-1' };
      prisma.uploaderRequest.update.mockResolvedValue(rejectedRequest);

      const result = await service.reject('req-1', 'admin-1');

      expect(result.status).toBe(UploaderRequestStatus.REJECTED);
      expect(result.reviewedById).toBe('admin-1');
    });

    it('throws BadRequestException if request is already resolved', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: UploaderRequestStatus.REJECTED,
      });

      await expect(service.reject('req-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if request does not exist', async () => {
      prisma.uploaderRequest.findUnique.mockResolvedValue(null);

      await expect(service.reject('nope', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
});
