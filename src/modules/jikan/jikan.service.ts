import { Injectable, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

export interface JikanSearchResult {
  malId: number;
  title: string;
  type?: string;
  episodes?: number;
  synopsis?: string;
  imageUrl?: string;
}

/**
 * Cliente Jikan (MyAnimeList). Ver spec 014-integracion-jikan.
 * Implementación real (búsqueda, import, rate-limit, caché) en fase TDD.
 */
@Injectable()
export class JikanService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  search(_query: string): Promise<JikanSearchResult[]> {
    throw new NotImplementedException('JikanService.search');
  }

  importAnime(_malId: number): Promise<void> {
    throw new NotImplementedException('JikanService.importAnime');
  }
}
