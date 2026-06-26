# Catálogo Público (Anime)

## Módulo: `anime`

Catálogo público de animes y episodios. Sin auth para lectura pública; auth requerida para gestión de episodios (uploader/admin).

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/anime` | Público | Catálogo con búsqueda, filtros y paginación |
| GET | `/api/anime/:slug` | Público | Ficha de anime por slug |
| GET | `/api/anime/:slug/episodes` | UPLOADER, ADMIN | Episodios de un anime (gestión upload) |
| GET | `/api/anime/:slug/episodes/:number` | Público | Episodio específico con video sources |
| GET | `/api/home` | Público | Home: animes destacados, recientes, populares |

## Query Params — Catálogo (`GET /api/anime`)

| Param | Tipo | Descripción |
|-------|------|-------------|
| `q` | string | Búsqueda por título |
| `genre` | string | Filtrar por género |
| `type` | string | Filtrar por tipo (TV, MOVIE, OVA, ONA, SPECIAL) |
| `status` | string | Filtrar por estado (ONGOING, COMPLETED, UPCOMING) |
| `page` | number | Página (default: 1) |
| `pageSize` | number | Items por página (default: 24) |

## Respuesta — Catálogo

```typescript
{
  data: Anime[],
  total: number,
  page: number,
  pageSize: number,
  totalPages: number
}
```

## Respuesta — Episodio (`GET /api/anime/:slug/episodes/:number`)

```typescript
{
  id: string,
  episodeNumber: number,
  title: string | null,
  description: string | null,
  thumbnailUrl: string | null,
  isFiller: boolean,
  videoSources: {
    id: string,
    provider: "DOODSTREAM" | "MIXDROP" | "STREAMTAPE",
    embedUrl: string,
    isActive: boolean
  }[]
}
```

## Visibilidad

- **Catálogo público**: solo animes con `isEnabled = true`
- **Episodios públicos**: solo episodios con `isEnabled = true` y `moderationStatus = APPROVED`
- **Video sources públicas**: solo con `isActive = true` y `status = READY`

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `anime.controller.ts` | Endpoints del catálogo |
| `home.controller.ts` | Endpoint de home |
| `anime.service.ts` | Lógica de consulta, filtros, paginación |
| `anime.module.ts` | Configuración del módulo |
