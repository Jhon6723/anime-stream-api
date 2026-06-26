# Upload de Videos

## Módulo: `upload`

Sistema de upload de videos a múltiples proveedores. Soporta upload local, streaming, remoto, bulk y CSV. Usa BullMQ para procesamiento asíncrono.

## Endpoints

| Método | Ruta | Auth | Status | Descripción |
|--------|------|------|--------|-------------|
| POST | `/api/upload` | UPLOADER, ADMIN | 202 | Crear job de upload (local o remote) |
| POST | `/api/upload/presign` | UPLOADER, ADMIN | 200 | Obtener URL presign para upload directo |
| POST | `/api/upload/stream` | UPLOADER, ADMIN | 201 | Upload via streaming (multipart) |
| POST | `/api/upload/confirm` | UPLOADER, ADMIN | 201 | Confirmar upload completado |
| POST | `/api/upload/bulk` | UPLOADER, ADMIN | 202 | Crear múltiples jobs de upload |
| POST | `/api/upload/csv` | UPLOADER, ADMIN | 202 | Crear jobs desde archivo CSV |
| GET | `/api/upload/jobs` | UPLOADER, ADMIN | 200 | Listar jobs (admin: todos, uploader: propios) |
| GET | `/api/upload/jobs/:id` | UPLOADER, ADMIN | 200 | Detalle de un job |

## DTOs

### CreateUploadDto
```typescript
{
  episodeId: string;
  provider: "DOODSTREAM" | "MIXDROP" | "STREAMTAPE";
  sourceType: "LOCAL" | "REMOTE_URL";
  sourceUrl?: string;  // requerido si sourceType = REMOTE_URL
}
```

### PresignUploadDto
```typescript
{
  episodeId: string;
  provider: "DOODSTREAM" | "MIXDROP" | "STREAMTAPE";
  fileName: string;
}
```

### ConfirmUploadDto
```typescript
{
  videoSourceId: string;
  providerFileId: string;
}
```

### BulkUploadDto
```typescript
{
  uploads: CreateUploadDto[];
}
```

## Flujo de Upload

### Upload Local
1. `POST /upload` con `sourceType: LOCAL` → crea `UploadJob` (status: QUEUED)
2. BullMQ processor toma el job → sube archivo al provider
3. Crea `VideoSource` con `status: UPLOADING`
4. Polling del provider hasta `status: READY`
5. Actualiza `VideoSource.status = READY`

### Upload Presign (directo al provider)
1. `POST /upload/presign` → retorna URL temporal
2. Cliente sube archivo directamente al provider
3. `POST /upload/confirm` con el `providerFileId` → crea `VideoSource`

### Upload Streaming (proxy)
1. `POST /upload/stream` (multipart/form-data, campo `file`)
2. Server recibe el buffer y lo forwarda al provider
3. Crea `VideoSource` automáticamente

### Upload Remoto
1. `POST /upload` con `sourceType: REMOTE_URL` y `sourceUrl`
2. BullMQ processor hace remote upload al provider
3. Polling hasta completar

## Estados de UploadJob

| Estado | Descripción |
|--------|-------------|
| `QUEUED` | En cola esperando procesamiento |
| `UPLOADING` | Subiendo archivo al provider |
| `PROCESSING` | Provider procesando/encoding |
| `COMPLETED` | Upload finalizado correctamente |
| `FAILED` | Error durante el upload |

## Cola BullMQ

- **Nombre**: `upload` (constante `UPLOAD_QUEUE`)
- **JobData**: `{ uploadJobId: string }`
- **Processor**: `upload.processor.ts`
- **Retry**: configurado en BullMQ

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `upload.controller.ts` | Endpoints REST |
| `upload.service.ts` | Lógica de creación de jobs |
| `upload.processor.ts` | Processor BullMQ (procesa jobs) |
| `dto/create-upload.dto.ts` | DTO de creación |
| `dto/presign-upload.dto.ts` | DTO de presign |
| `dto/confirm-upload.dto.ts` | DTO de confirmación |
| `dto/bulk-upload.dto.ts` | DTO de bulk upload |
