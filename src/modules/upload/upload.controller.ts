import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Provider, UserRole } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.UPLOADER)
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(202)
  createUpload(@Body() dto: CreateUploadDto, @CurrentUser() user: AuthUser) {
    return this.uploadService.createUpload(dto, user.id);
  }

  @Post('presign')
  presignUpload(@Body() dto: PresignUploadDto, @CurrentUser() _user: AuthUser) {
    return this.uploadService.presignUpload(dto);
  }

  @Post('stream')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  streamUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('episodeId') episodeId: string,
    @Body('provider') provider: Provider,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadService.streamUpload(
      file.buffer,
      file.originalname,
      episodeId,
      provider,
      user.id,
    );
  }

  @Post('confirm')
  @HttpCode(201)
  confirmUpload(@Body() dto: ConfirmUploadDto, @CurrentUser() user: AuthUser) {
    return this.uploadService.confirmUpload(dto, user.id);
  }

  @Post('bulk')
  @HttpCode(202)
  createBulkUpload(@Body() dto: BulkUploadDto, @CurrentUser() user: AuthUser) {
    return this.uploadService.createBulkUpload(dto, user.id);
  }

  @Post('csv')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  createCsvUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Query('provider') provider: Provider,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    const content = file.buffer.toString('utf-8');
    return this.uploadService.createCsvUpload(content, provider, user.id);
  }

  @Get('jobs')
  listJobs(@CurrentUser() user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      return this.uploadService.listJobs();
    }
    return this.uploadService.listJobs(user.id);
  }

  @Get('jobs/:id')
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.ADMIN) {
      return this.uploadService.getJob(id);
    }
    return this.uploadService.getJob(id, user.id);
  }
}
