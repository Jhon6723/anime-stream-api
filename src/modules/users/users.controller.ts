import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserEmailDto } from './dto/update-user-email.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  createByAdmin(
    @Body() dto: CreateUserByAdminDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.createByAdmin(dto, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.updateRole(id, dto, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.updateStatus(id, dto, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/email')
  updateEmail(
    @Param('id') id: string,
    @Body() dto: UpdateUserEmailDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.updateEmail(id, dto, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/password')
  updatePassword(
    @Param('id') id: string,
    @Body() dto: UpdateUserPasswordDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.updatePassword(id, dto, admin.id);
  }
}
