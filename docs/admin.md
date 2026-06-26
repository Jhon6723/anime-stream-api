# Dashboard Admin

## Módulo: `admin`

Dashboard administrativo con overview, hard delete de contenido y configuración global del sistema.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/admin/overview` | ADMIN | Métricas generales de la plataforma |
| DELETE | `/api/admin/animes/:id` | ADMIN | Hard delete de anime |
| DELETE | `/api/admin/episodes/:id` | ADMIN | Hard delete de episodio |
| DELETE | `/api/admin/video-sources/:id` | ADMIN | Hard delete de video source |
| GET | `/api/admin/config` | ADMIN | Listar configuraciones del sistema |
| GET | `/api/admin/config?category=SEO` | ADMIN | Filtrar por categoría |
| PUT | `/api/admin/config` | ADMIN | Crear o actualizar configuración |
| DELETE | `/api/admin/config/:key` | ADMIN | Eliminar configuración |

## Overview

`GET /api/admin/overview` retorna:

```typescript
{
  activeAnimes: number;       // animes con isEnabled = true
  pendingUploads: number;     // uploadJobs en QUEUED, UPLOADING, PROCESSING
  totalUsers: number;
  pendingModeration: number;  // episodios con moderationStatus = PENDING
  totalEpisodes: number;
  totalVideoSources: number;
}
```

## Hard Delete

Los endpoints de hard delete requieren confirmación explícita y registran la acción en `ModerationLog`.

### HardDeleteDto
```typescript
{
  confirm: "CONFIRM";  // debe ser exactamente "CONFIRM"
  reason: string;      // motivo obligatorio
}
```

### Comportamiento

- Si `confirm !== "CONFIRM"` → `400 BadRequest`
- Se crea `ModerationLog` con `action: HARD_DELETE` antes de eliminar
- La eliminación es en cascada (Prisma `onDelete: Cascade` en episodios y video sources)
- La acción es **irreversible**

## SystemConfig

Configuración global persistida en DB. Valores sensibles se encriptan con AES-256-GCM.

### Categorías

| Categoría | Uso |
|-----------|-----|
| `SEO` | Título global, descripción, keywords |
| `MODERATION` | Umbrales, reglas automáticas |
| `GENERAL` | Configuración general |

### UpdateSystemConfigDto
```typescript
{
  key: string;           // ej: "seo.title"
  value: string;
  category?: "SEO" | "MODERATION" | "GENERAL";
  isSensitive?: boolean;  // default: false
}
```

### Encriptación

- Valores con `isSensitive = true` se encriptan antes de guardar
- Respuestas a cliente: valores sensibles se retornan masked (ej: `abc***xyz`)
- Usa el mismo patrón que `ProviderAccountService` (`encrypt`/`decrypt` de `crypto.util.ts`)
- Clave de encriptación: `ENCRYPTION_KEY` desde env vars

### Métodos del Service

| Método | Descripción |
|--------|-------------|
| `findAll()` | Lista todas las configs (sensibles masked) |
| `findByCategory(cat)` | Filtra por categoría |
| `upsert(dto)` | Crea o actualiza una config |
| `getValue(key)` | Retorna valor desencriptado (uso interno) |
| `getDecryptedValue(key)` | Retorna valor desencriptado (throw si no existe) |
| `remove(key)` | Elimina una config |

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `admin.controller.ts` | Endpoints REST |
| `admin.service.ts` | Lógica de overview y hard delete |
| `system-config.service.ts` | Lógica de SystemConfig (encrypt/decrypt) |
| `dto/hard-delete.dto.ts` | DTO de hard delete |
| `dto/update-system-config.dto.ts` | DTO de SystemConfig |
| `admin.module.ts` | Configuración del módulo |
