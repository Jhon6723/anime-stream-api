import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DoodstreamAdapter } from './adapters/doodstream.adapter';
import { MixdropAdapter } from './adapters/mixdrop.adapter';
import { StreamtapeAdapter } from './adapters/streamtape.adapter';
import { ProviderAccountController } from './provider-account.controller';
import { ProviderAccountService } from './provider-account.service';
import { ProviderRegistryService } from './provider-registry.service';

@Module({
  imports: [HttpModule],
  controllers: [ProviderAccountController],
  providers: [
    DoodstreamAdapter,
    MixdropAdapter,
    StreamtapeAdapter,
    ProviderRegistryService,
    ProviderAccountService,
  ],
  exports: [ProviderRegistryService, ProviderAccountService],
})
export class ProvidersModule {}
