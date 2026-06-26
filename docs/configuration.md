# Configuración y Variables de Entorno

## AppConfig

La configuración se carga desde variables de entorno y se valida mediante la interfaz `AppConfig` en `src/config/configuration.ts`.

## Variables de Entorno

### Bootstrap (requeridas para arrancar)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | URL de conexión a PostgreSQL |
| `REDIS_HOST` | `localhost` | Host de Redis |
| `REDIS_PORT` | `6379` | Puerto de Redis |
| `REDIS_PASSWORD` | — | Password de Redis (opcional) |
| `ENCRYPTION_KEY` | `dev-encryption-key-change-me` | Clave para encriptar API keys y SystemConfig sensible |
| `JWT_ACCESS_SECRET` | `dev-access-secret` | Secret del access token JWT |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Expiración del access token |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret` | Secret del refresh token JWT |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiración del refresh token |
| `PORT` | `4000` | Puerto del servidor |
| `NODE_ENV` | `development` | Entorno |
| `CORS_ORIGIN` | `http://localhost:3000` | Origen permitido para CORS |

### Jikan API

| Variable | Default | Descripción |
|----------|---------|-------------|
| `JIKAN_BASE_URL` | `https://api.jikan.moe/v4` | URL base Jikan |
| `JIKAN_CACHE_TTL` | `86400` | TTL cache en segundos |
| `JIKAN_MAX_RPS` | `3` | Max requests per second |

### Proveedores de Video (defaults, las API keys reales van en ProviderAccount)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DOODSTREAM_BASE_URL` | `https://doodapi.co/api` | URL base Doodstream |
| `MIXDROP_BASE_URL` | `https://api.mixdrop.ag` | URL base MixDrop API |
| `MIXDROP_UPLOAD_BASE_URL` | `https://ul.mixdrop.ag/api` | URL base MixDrop upload |
| `STREAMTAPE_BASE_URL` | `https://api.streamtape.com` | URL base Streamtape |

## Archivo .env

```env
# DB
DATABASE_URL=postgresql://user:pass@localhost:5432/anime_stream

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
ENCRYPTION_KEY=your-encryption-key-here
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Jikan
JIKAN_BASE_URL=https://api.jikan.moe/v4
JIKAN_CACHE_TTL=86400
JIKAN_MAX_RPS=3

# Providers (base URLs, las API keys van en DB)
DOODSTREAM_BASE_URL=https://doodapi.co/api
MIXDROP_BASE_URL=https://api.mixdrop.ag
MIXDROP_UPLOAD_BASE_URL=https://ul.mixdrop.ag/api
STREAMTAPE_BASE_URL=https://api.streamtape.com
```

## SystemConfig vs .env

| Tipo | Dónde | Editable | Ejemplo |
|------|-------|----------|---------|
| Bootstrap | `.env` | No (reiniciar app) | `DATABASE_URL`, `JWT_ACCESS_SECRET` |
| API Keys providers | `ProviderAccount` (DB) | Sí (admin UI) | API key Doodstream |
| Config operativa | `SystemConfig` (DB) | Sí (admin UI) | `seo.title`, umbrales moderación |
