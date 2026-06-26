import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemConfigCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.get<string>('encryptionKey')!;
  }

  async findAll() {
    const configs = await this.prisma.systemConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return configs.map((c) => ({
      id: c.id,
      key: c.key,
      value: c.isSensitive ? this.maskValue(c.value) : c.value,
      isSensitive: c.isSensitive,
      category: c.category,
      updatedAt: c.updatedAt,
    }));
  }

  async findByCategory(category: SystemConfigCategory) {
    const configs = await this.prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return configs.map((c) => ({
      id: c.id,
      key: c.key,
      value: c.isSensitive ? this.maskValue(c.value) : c.value,
      isSensitive: c.isSensitive,
      category: c.category,
      updatedAt: c.updatedAt,
    }));
  }

  async upsert(dto: UpdateSystemConfigDto) {
    const isSensitive = dto.isSensitive ?? false;
    const storedValue = isSensitive
      ? encrypt(dto.value, this.encryptionKey)
      : dto.value;

    const config = await this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      update: {
        value: storedValue,
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isSensitive !== undefined ? { isSensitive } : {}),
      },
      create: {
        key: dto.key,
        value: storedValue,
        isSensitive,
        category: dto.category ?? SystemConfigCategory.GENERAL,
      },
    });

    return {
      id: config.id,
      key: config.key,
      value: config.isSensitive ? this.maskValue(config.value) : config.value,
      isSensitive: config.isSensitive,
      category: config.category,
      updatedAt: config.updatedAt,
    };
  }

  async getDecryptedValue(key: string): Promise<string> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!config) {
      throw new NotFoundException(`SystemConfig ${key} not found`);
    }
    return config.isSensitive
      ? decrypt(config.value, this.encryptionKey)
      : config.value;
  }

  async getValue(key: string): Promise<string | null> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!config) return null;
    return config.isSensitive
      ? decrypt(config.value, this.encryptionKey)
      : config.value;
  }

  async remove(key: string) {
    const existing = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!existing) {
      throw new NotFoundException(`SystemConfig ${key} not found`);
    }
    await this.prisma.systemConfig.delete({ where: { key } });
    return { key, deleted: true };
  }

  private maskValue(encryptedValue: string): string {
    try {
      const plain = decrypt(encryptedValue, this.encryptionKey);
      if (plain.length <= 6) return '***';
      return `${plain.slice(0, 3)}***${plain.slice(-3)}`;
    } catch {
      return '***';
    }
  }
}
