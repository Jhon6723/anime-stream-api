import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashed'),
  compare: vi.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuthService } from './auth.service';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: '$2b$12$hashedpassword',
  role: 'USER',
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let jwt: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let config: { get: ReturnType<typeof vi.fn> };
  let redis: {
    blacklistToken: ReturnType<typeof vi.fn>;
    isTokenBlacklisted: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$hashed' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    prisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    jwt = {
      signAsync: vi
        .fn()
        .mockImplementation(
          (payload: { jti?: string }, opts: { secret: string }) => {
            const token = `token-${opts.secret.includes('refresh') ? 'refresh' : 'access'}-${payload.jti ?? 'no-jti'}`;
            return Promise.resolve(token);
          },
        ),
      verifyAsync: vi.fn(),
    };

    config = {
      get: vi.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'access-secret',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        };
        return map[key];
      }),
    };

    redis = {
      blacklistToken: vi.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      redis as unknown as RedisService,
    );
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@test.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(prisma.user.create).toHaveBeenCalledOnce();
    });

    it('throws ConflictException if email or username exists', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@test.com',
          username: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
    });

    it('throws UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException for non-active user', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('returns new tokens for valid refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(redis.blacklistToken).toHaveBeenCalledWith(
        'jti-1',
        expect.any(Number),
      );
    });

    it('throws UnauthorizedException for blacklisted token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      redis.isTokenBlacklisted.mockResolvedValue(true);

      await expect(service.refresh('blacklisted-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for non-existent user', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for invalid token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('blacklists the refresh token jti', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });

      await service.logout('valid-refresh-token');

      expect(redis.blacklistToken).toHaveBeenCalledWith(
        'jti-1',
        expect.any(Number),
      );
    });

    it('does not throw for invalid token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.logout('invalid-token')).resolves.toBeUndefined();
      expect(redis.blacklistToken).not.toHaveBeenCalled();
    });
  });
});
