import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: 'hashed',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  approvedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns users with selected fields', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
    });
  });

  describe('findOne', () => {
    it('returns user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result.id).toBe('user-1');
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('updates user role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.MODERATOR });

      const result = await service.updateRole(
        'user-1',
        { role: UserRole.MODERATOR },
        'admin-1',
      );

      expect(result.role).toBe(UserRole.MODERATOR);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.MODERATOR },
        select: expect.any(Object),
      });
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole('nope', { role: UserRole.MODERATOR }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when changing own role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updateRole('user-1', { role: UserRole.ADMIN }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveUploader', () => {
    it('approves a user as uploader and sets approvedById', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        role: UserRole.UPLOADER,
        approvedById: 'admin-1',
      });

      const result = await service.approveUploader('user-1', 'admin-1');

      expect(result.role).toBe(UserRole.UPLOADER);
      expect(result.approvedById).toBe('admin-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.UPLOADER, approvedById: 'admin-1' },
        select: expect.any(Object),
      });
    });

    it('throws BadRequestException if already uploader', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.UPLOADER,
      });

      await expect(service.approveUploader('user-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.approveUploader('nope', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('updates user status', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, status: UserStatus.SUSPENDED });

      const result = await service.updateStatus(
        'user-1',
        { status: UserStatus.SUSPENDED },
        'admin-1',
      );

      expect(result.status).toBe(UserStatus.SUSPENDED);
    });

    it('throws BadRequestException when changing own status', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updateStatus('user-1', { status: UserStatus.BANNED }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('nope', { status: UserStatus.BANNED }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
