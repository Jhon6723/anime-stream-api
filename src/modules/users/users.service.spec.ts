import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashed'),
}));

import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: 'hashed',
  role: UserRole.UPLOADER,
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
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$hashed' as never);

    prisma = {
      user: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
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
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        role: UserRole.MODERATOR,
      });

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

  describe('updateStatus', () => {
    it('updates user status', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

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

  describe('createByAdmin', () => {
    it('creates a moderator with hashed password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'mod@example.com',
        username: 'mod1',
        role: UserRole.MODERATOR,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
      });

      const result = await service.createByAdmin(
        {
          email: 'mod@example.com',
          username: 'mod1',
          password: 'Password123!',
        },
        'admin-1',
      );

      expect(result.role).toBe(UserRole.MODERATOR);
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'mod@example.com',
          username: 'mod1',
          passwordHash: '$2b$12$hashed',
          role: UserRole.MODERATOR,
          status: 'ACTIVE',
          approvedById: 'admin-1',
        },
        select: expect.any(Object),
      });
    });

    it('creates an uploader when role is specified', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'up@example.com',
        username: 'up1',
        role: UserRole.UPLOADER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
      });

      const result = await service.createByAdmin(
        {
          email: 'up@example.com',
          username: 'up1',
          password: 'Password123!',
          role: UserRole.UPLOADER,
        },
        'admin-1',
      );

      expect(result.role).toBe(UserRole.UPLOADER);
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.createByAdmin(
          {
            email: 'test@test.com',
            username: 'mod1',
            password: 'Password123!',
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
