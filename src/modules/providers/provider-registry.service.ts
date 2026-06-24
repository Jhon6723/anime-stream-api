import { Injectable, NotFoundException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { VideoProvider } from './video-provider.interface';
import { DoodstreamAdapter } from './adapters/doodstream.adapter';
import { MixdropAdapter } from './adapters/mixdrop.adapter';
import { StreamtapeAdapter } from './adapters/streamtape.adapter';

/**
 * Registro central de adapters. Resuelve el adapter a usar según el enum
 * Provider. Ver spec 011-multi-provider-redundancia.
 */
@Injectable()
export class ProviderRegistryService {
  private readonly registry: Map<Provider, VideoProvider>;

  constructor(
    doodstream: DoodstreamAdapter,
    mixdrop: MixdropAdapter,
    streamtape: StreamtapeAdapter,
  ) {
    this.registry = new Map<Provider, VideoProvider>([
      [Provider.DOODSTREAM, doodstream],
      [Provider.MIXDROP, mixdrop],
      [Provider.STREAMTAPE, streamtape],
    ]);
  }

  get(provider: Provider): VideoProvider {
    const adapter = this.registry.get(provider);
    if (!adapter) {
      throw new NotFoundException(`No adapter for provider ${provider}`);
    }
    return adapter;
  }

  all(): VideoProvider[] {
    return [...this.registry.values()];
  }
}
