# Moderación

## Módulo: `moderation`

Sistema de moderación de episodios con cola de revisión, acciones y audit log.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/moderation/queue` | ADMIN, MODERATOR | Cola de episodios pendientes (paginada) |
| GET | `/api/moderation/logs` | ADMIN, MODERATOR | Audit log (opcional: filtrar por `episodeId`) |
| POST | `/api/moderation/episodes/:id/approve` | ADMIN, MODERATOR | Aprobar episodio |
| POST | `/api/moderation/episodes/:id/warn` | ADMIN, MODERATOR | Advertir episodio |
| POST | `/api/moderation/episodes/:id/disable` | ADMIN, MODERATOR | Deshabilitar episodio |
| POST | `/api/moderation/episodes/:id/enable` | ADMIN, MODERATOR | Rehabilitar episodio |

## ModerationActionDto

```typescript
{
  reason: string;
  notes?: string;
}
```

## Estados de Moderación

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Pendiente de revisión |
| `APPROVED` | Aprobado y visible públicamente |
| `WARNED` | Advertido (visible con nota) |
| `DISABLED` | Deshabilitado (no visible) |

## Acciones de Moderación

| Acción | Efecto |
|--------|--------|
| `APPROVE` | `moderationStatus → APPROVED` |
| `WARNING` | `moderationStatus → WARNED` |
| `DISABLE` | `moderationStatus → DISABLED`, `isEnabled → false` |
| `RE_ENABLE` | `moderationStatus → APPROVED`, `isEnabled → true` |
| `HARD_DELETE` | Eliminación permanente (auditado en log) |

## Audit Log

Cada acción genera un registro en `ModerationLog` con:
- `animeId`, `episodeId` (referencias)
- `moderatorId` (quén realizó la acción)
- `action` (tipo de acción)
- `reason` (motivo obligatorio)
- `notes` (notas opcionales)

## Websocket

Eventos de moderación emitidos via WebsocketModule para actualización en tiempo real del dashboard.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `moderation.controller.ts` | Endpoints REST |
| `moderation.service.ts` | Lógica de moderación |
| `dto/moderation-action.dto.ts` | DTO de acción |
| `moderation.module.ts` | Configuración del módulo |
