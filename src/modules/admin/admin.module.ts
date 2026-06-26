import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemConfigService } from './system-config.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SystemConfigService],
  exports: [AdminService, SystemConfigService],
})
export class AdminModule {}
