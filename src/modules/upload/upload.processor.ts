import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UPLOAD_QUEUE, UploadJobData } from '../../queue/queue.constants';

/**
 * Worker que procesa los jobs de upload (archivo o remote URL) y los envía a
 * los proveedores vía ProviderRegistryService. Lógica real en fase TDD.
 * Ver specs 007 (upload masivo) y 011 (multi-provider).
 */
@Processor(UPLOAD_QUEUE)
export class UploadProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadProcessor.name);

  async process(job: Job<UploadJobData>): Promise<void> {
    this.logger.log(`Processing upload job ${job.id} (scaffold no-op)`);
    return Promise.resolve();
  }
}
