import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UPLOAD_QUEUE, UploadJobData } from '../../queue/queue.constants';

@Injectable()
export class UploadService {
  constructor(
    @InjectQueue(UPLOAD_QUEUE)
    private readonly uploadQueue: Queue<UploadJobData>,
    private readonly prisma: PrismaService,
  ) {}

  listJobs() {
    return this.prisma.uploadJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async enqueue(uploadJobId: string): Promise<void> {
    await this.uploadQueue.add('process-upload', { uploadJobId });
  }
}
