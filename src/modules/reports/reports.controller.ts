import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BrokenLinkReportDto } from './dto/broken-link-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports/broken-link')
  reportBrokenLink(
    @Body() dto: BrokenLinkReportDto,
    @Req() req: { ip: string; headers: Record<string, string> },
  ) {
    const userAgent = req.headers['user-agent'];
    return this.reportsService.reportBrokenLink(
      dto.videoSourceId,
      req.ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reports/broken-links')
  listBrokenLinks(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;
    return this.reportsService.listBrokenLinks(page, pageSize);
  }
}
