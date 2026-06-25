import { Module } from '@nestjs/common';
import { UploaderRequestsService } from './uploader-requests.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UploaderRequestsService],
  exports: [UsersService, UploaderRequestsService],
})
export class UsersModule {}
