import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserEmailDto } from './dto/update-user-email.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        approvedById: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        approvedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === adminId) {
      throw new BadRequestException('Cannot change your own role');
    }
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === adminId) {
      throw new BadRequestException('Cannot change your own status');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    });
  }

  async updateEmail(id: string, dto: UpdateUserEmailDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === adminId) {
      throw new BadRequestException('Cannot change your own email here');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing && existing.id !== id) {
      throw new ConflictException('Email already in use');
    }
    return this.prisma.user.update({
      where: { id },
      data: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    });
  }

  async updatePassword(id: string, dto: UpdateUserPasswordDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === adminId) {
      throw new BadRequestException('Cannot change your own password here');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    });
  }

  async createByAdmin(dto: CreateUserByAdminDto, adminId: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }],
      },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = dto.role ?? UserRole.MODERATOR;

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        passwordHash,
        role,
        status: 'ACTIVE',
        approvedById: adminId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
