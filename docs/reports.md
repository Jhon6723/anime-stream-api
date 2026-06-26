# Reportes

## Módulo: `reports`

Sistema de reporte de links rotos por parte de los usuarios.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/reports/broken-link` | Público | Reportar un link roto |
| GET | `/api/admin/reports/broken-links` | ADMIN | Listar reportes (paginado) |

## BrokenLinkReportDto

```typescript
{
  videoSourceId: string;
}
```

## Modelo BrokenLinkReport

```typescript
{
  id: string;
  videoSourceId: string;
  ipAddress: string;    // IP del reportante
  userAgent?: string;   // User-Agent del reportante
  createdAt: Date;
}
```

## Comportamiento

- Cualquier usuario (sin auth) puede reportar un link roto
- Se registra la IP y User-Agent para prevenir abuso
- Los admins pueden ver los reportes paginados
- Relación con `VideoSource` con `onDelete: Cascade`

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `reports.controller.ts` | Endpoints REST |
| `reports.service.ts` | Lógica de reportes |
| `dto/broken-link-report.dto.ts` | DTO de reporte |
| `reports.module.ts` | Configuración del módulo |
