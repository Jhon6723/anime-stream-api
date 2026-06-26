# AnimeStream Hub API — Documentación Técnica

## Visión General

Backend de la plataforma de streaming de anime construido con **NestJS**, **Prisma** (PostgreSQL), **Redis** y **BullMQ**.

### Stack Tecnológico

| Componente | Tecnología |
|------------|-----------|
| Framework | NestJS 11 |
| ORM | Prisma 6 |
| DB | PostgreSQL |
| Cache/Queue | Redis + BullMQ |
| Auth | JWT (access + refresh) |
| Docs API | Swagger/OpenAPI |
| Test | Vitest |

### Estructura del Proyecto

```
src/
├── common/          # Guards, decoradores, interceptors, utils
├── config/          # Configuración (env vars → AppConfig)
├── health/          # Health check endpoint
├── prisma/          # PrismaService
├── queue/           # Constantes de colas BullMQ
├── redis/           # RedisModule
├── websocket/       # Websocket gateway
├── modules/
│   ├── admin/       # Dashboard admin, hard delete, system config
│   ├── ads/         # Gestión de anuncios (AdSense/custom)
│   ├── anime/       # Catálogo público, fichas, episodios
│   ├── auth/        # Registro, login, refresh, logout
│   ├── jikan/       # Integración Jikan API (MyAnimeList)
│   ├── moderation/  # Cola de moderación, acciones, logs
│   ├── providers/   # Adapters de proveedores de video
│   ├── reports/     # Reportes de links rotos
│   ├── upload/      # Upload de videos (local, stream, remote, bulk, CSV)
│   └── users/       # Gestión de usuarios, roles, uploader requests
└── main.ts          # Bootstrap, CORS, Swagger, pipes
```

### Documentación por Módulo

- [Autenticación](./auth.md)
- [Catálogo Público (Anime)](./anime.md)
- [Upload de Videos](./upload.md)
- [Proveedores de Video](./providers.md)
- [Moderación](./moderation.md)
- [Gestión de Usuarios](./users.md)
- [Dashboard Admin](./admin.md)
- [Integración Jikan](./jikan.md)
- [Anuncios (Ads)](./ads.md)
- [Reportes](./reports.md)
- [Modelo de Datos](./data-model.md)
- [Configuración y Variables de Entorno](./configuration.md)
- [Colas y Jobs Asíncronos](./queues.md)

### Ejecutar el Proyecto

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Sincronizar DB (dev)
npx prisma db push

# Migración (prod)
npx prisma migrate deploy

# Iniciar en modo dev
npm run start:dev

# Compilar
npm run build

# Tests
npx vitest run

# Type check
npx tsc --noEmit
```

### Swagger

Disponible en `http://localhost:4000/api/docs` cuando el servidor está corriendo.

### Convenciones

- **Prefijo global**: `/api` en todas las rutas
- **Auth**: Bearer JWT en header `Authorization`
- **Roles**: `ADMIN`, `MODERATOR`, `UPLOADER`, `USER`
- **Validación**: `ValidationPipe` con `whitelist`, `transform`, `forbidNonWhitelisted`
- **CORS**: Configurable via `CORS_ORIGIN`
- **Rate limiting**: 120 requests/minuto (ThrottlerGuard)
