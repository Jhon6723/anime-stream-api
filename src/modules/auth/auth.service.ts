import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

export interface AuthUserResponse {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }],
      },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        passwordHash,
      },
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        jti: string;
      }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const isBlacklisted = await this.redis.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.redis.blacklistToken(payload.jti, this.getRefreshTtlSeconds());
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        jti: string;
      }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      await this.redis.blacklistToken(payload.jti, this.getRefreshTtlSeconds());
    } catch {
      // Token is invalid/expired — nothing to blacklist
    }
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>(
        'jwt.accessExpiresIn',
      ) as import('ms').StringValue,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>(
          'jwt.refreshExpiresIn',
        ) as import('ms').StringValue,
      },
    );
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    };
  }

  private getRefreshTtlSeconds(): number {
    const expiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };
    return value * (multipliers[unit] ?? 24 * 60 * 60);
  }
}
