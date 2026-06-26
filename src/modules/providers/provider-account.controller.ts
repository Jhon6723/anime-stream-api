import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateProviderAccountDto,
  UpdateProviderAccountDto,
} from './dto/provider-account.dto';
import { ProviderAccountService } from './provider-account.service';

@ApiTags('provider-accounts')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/providers/accounts')
export class ProviderAccountController {
  constructor(private readonly accountService: ProviderAccountService) {}

  @Get()
  list() {
    return this.accountService.list();
  }

  @Post()
  create(@Body() dto: CreateProviderAccountDto) {
    return this.accountService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderAccountDto,
  ) {
    return this.accountService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.remove(id);
  }
}
