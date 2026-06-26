# Integración Jikan

## Módulo: `jikan`

Integración con la API de Jikan (MyAnimeList) para importar metadatos de animes y episodios automáticamente.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/jikan/search?q=...` | UPLOADER, ADMIN, MODERATOR | Buscar anime en MAL |
| GET | `/api/jikan/seasons/now` | UPLOADER, ADMIN, MODERATOR | Animes de la temporada actual |
| GET | `/api/jikan/anime/:malId` | UPLOADER, ADMIN, MODERATOR | Preview de anime por MAL ID |
| POST | `/api/jikan/import/:malId` | UPLOADER, ADMIN | Importar anime + episodios a la DB |

## Configuración

| Env Var | Default | Descripción |
|---------|---------|-------------|
| `JIKAN_BASE_URL` | `https://api.jikan.moe/v4` | URL base de Jikan API |
| `JIKAN_CACHE_TTL` | `86400` (24h) | TTL del cache en segundos |
| `JIKAN_MAX_RPS` | `3` | Max requests per second (rate limit) |

## Flujo de Importación

1. **Búsqueda**: `GET /jikan/search?q=naruto` → lista de resultados de MAL
2. **Preview**: `GET /jikan/anime/20` → detalle del anime antes de importar
3. **Importación**: `POST /jikan/import/20` → crea `Anime` + `Episode[]` en la DB
   - Genera slug único a partir del título
   - Mapea géneros, estudios, tipo, estado
   - Crea episodios con `moderationStatus: PENDING`
   - Marca `jikanId` y `jikanEpisodeId` para evitar duplicados
   - Si el anime ya existe (por `jikanId`), retorna el existente

## Rate Limiting

Jikan API tiene un límite estricto. El servicio respeta `JIKAN_MAX_RPS` con delay entre requests.

## Cache

Las respuestas de Jikan se cachean por `JIKAN_CACHE_TTL` segundos para reducir llamadas a la API.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `jikan.controller.ts` | Endpoints REST |
| `jikan.service.ts` | Lógica de búsqueda, cache e importación |
| `jikan.module.ts` | Configuración del módulo |
