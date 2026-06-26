import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { CreateProviderAccountDto } from './dto/provider-account.dto';
import { UpdateProviderAccountDto } from './dto/provider-account.dto';

@Injectable()
export class ProviderAccountService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.get<string>('encryptionKey')!;
  }

  async list() {
    const accounts = await this.prisma.providerAccount.findMany({
      orderBy: [{ provider: 'asc' }, { priority: 'asc' }],
    });

    return accounts.map((acc) => ({
      id: acc.id,
      provider: acc.provider,
      label: acc.label,
      isActive: acc.isActive,
      priority: acc.priority,
      apiKeyMasked: this.maskKey(acc.apiKey),
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    }));
  }

  async create(dto: CreateProviderAccountDto) {
    const encryptedKey = encrypt(dto.apiKey, this.encryptionKey);

    const account = await this.prisma.providerAccount.create({
      data: {
        provider: dto.provider,
        label: dto.label,
        apiKey: encryptedKey,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
      },
    });

    return {
      id: account.id,
      provider: account.provider,
      label: account.label,
      isActive: account.isActive,
      priority: account.priority,
      apiKeyMasked: this.maskKey(encryptedKey),
    };
  }

  async update(id: string, dto: UpdateProviderAccountDto) {
    const existing = await this.prisma.providerAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ProviderAccount ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.apiKey !== undefined) {
      data.apiKey = encrypt(dto.apiKey, this.encryptionKey);
    }

    const account = await this.prisma.providerAccount.update({
      where: { id },
      data,
    });

    return {
      id: account.id,
      provider: account.provider,
      label: account.label,
      isActive: account.isActive,
      priority: account.priority,
      apiKeyMasked: this.maskKey(account.apiKey),
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.providerAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ProviderAccount ${id} not found`);
    }

    await this.prisma.providerAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  async resolveDecryptedApiKey(provider: Provider): Promise<string> {
    const account = await this.prisma.providerAccount.findFirst({
      where: { provider, isActive: true },
      orderBy: { priority: 'asc' },
    });

    if (!account) {
      throw new BadRequestException(`No active ProviderAccount for ${provider}`);
    }

    return decrypt(account.apiKey, this.encryptionKey);
  }

  private maskKey(encryptedKey: string): string {
    try {
      const plain = decrypt(encryptedKey, this.encryptionKey);
      if (plain.length <= 6) return '***';
      return `${plain.slice(0, 3)}***${plain.slice(-3)}`;
    } catch {
      return '***';
    }
  }
}
