import { Module } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import { DoodstreamAdapter } from './adapters/doodstream.adapter';
import { MixdropAdapter } from './adapters/mixdrop.adapter';
import { StreamtapeAdapter } from './adapters/streamtape.adapter';

@Module({
  providers: [
    DoodstreamAdapter,
    MixdropAdapter,
    StreamtapeAdapter,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService],
})
export class ProvidersModule {}
