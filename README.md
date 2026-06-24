# anime-stream-api

Backend de **AnimeStream Hub** — NestJS 11 + Prisma 6 (PostgreSQL) + BullMQ/Redis (colas) + WebSockets (Socket.IO) + JWT (Passport). Testing con Vitest.

Las specs que rigen este servicio viven en [`anime-stream-specs`](../anime-stream-specs).

## Stack

- **NestJS 11** (HTTP + WebSocket Gateway)
- **Prisma 6** sobre PostgreSQL 16 (ver `prisma/schema.prisma`, alineado con `MODELO_DATOS.md`)
- **BullMQ + Redis 7** para la cola de uploads y jobs programados (spec 007, 013)
- **Passport JWT** con guard global + RBAC por roles (specs 002, 003)
- **Swagger** en `/api/docs`
- **Vitest** para unit/e2e

## Requisitos

- Node.js 22.x
- Docker (para Postgres + Redis locales)

## Setup local

```bash
cp .env.example .env            # ajusta secretos si hace falta
docker compose up -d            # levanta Postgres + Redis
npm install
npm run prisma:generate
npm run prisma:migrate          # crea el schema en la DB
npm run prisma:seed             # crea usuario admin inicial
npm run start:dev               # API en http://localhost:4000/api
```

Swagger: http://localhost:4000/api/docs

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run start:dev` | API en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run lint` | ESLint (+ fix) |
| `npm test` | Vitest (unit + e2e) |
| `npm run test:cov` | Cobertura |
| `npm run prisma:migrate` | Migración de desarrollo |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:seed` | Seed de datos inicial |

## Estructura

```
src/
  config/          configuración tipada (env)
  common/          decorators y guards (roles, jwt, public)
  prisma/          PrismaModule/Service (global)
  modules/
    auth/          registro, login, refresh, JWT strategy
    users/         gestión de usuarios (admin)
    anime/         catálogo público (spec 001)
    jikan/         integración MyAnimeList (spec 014)
    providers/     interfaz VideoProvider + adapters Dood/MixDrop/Streamtape (specs 004-006, 011)
    upload/        cola BullMQ + processor (spec 007)
    moderation/    cola de moderación + audit log (spec 008)
    analytics/     métricas del dashboard (spec 009)
    ads/           configuración de anuncios (spec 010)
  queue/           constantes/contratos de colas
  websocket/       gateway de eventos en tiempo real
  health/          healthcheck
```

> **Estado:** scaffold. Los adapters de proveedores y la integración Jikan están
> definidos por su interfaz y se implementan por TDD una vez aprobadas las specs.
> Los métodos aún sin implementar lanzan `NotImplementedException` a propósito.
