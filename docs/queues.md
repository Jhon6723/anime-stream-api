# Colas y Jobs Asíncronos

## BullMQ

Sistema de colas asíncrono basado en Redis para procesamiento de jobs en background.

## Configuración

BullMQ se configura en `app.module.ts` con `BullModule.forRootAsync`:

```typescript
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password'),
    },
  }),
}),
```

## Colas

### Upload Queue

| Propiedad | Valor |
|-----------|-------|
| Nombre | `upload` (constante `UPLOAD_QUEUE`) |
| JobData | `{ uploadJobId: string }` |
| Processor | `src/queue/upload.processor.ts` |

#### Flujo

1. `UploadService.createUpload()` crea un `UploadJob` en DB (status: `QUEUED`)
2. Encola un job en BullMQ con `{ uploadJobId }`
3. `UploadProcessor` toma el job:
   - Obtiene el `UploadJob` de DB
   - Resuelve la API key desde `ProviderAccount`
   - Ejecuta el upload según `sourceType`:
     - `LOCAL`: `uploadFile()` o `streamUpload()`
     - `REMOTE_URL`: `remoteUpload()` + polling con `checkRemoteUpload()`
   - Crea/actualiza `VideoSource` con el resultado
   - Polling de `getFileInfo()` hasta `status: READY`
   - Actualiza `UploadJob.status = COMPLETED`
4. En caso de error: `UploadJob.status = FAILED`, `errorMessage` guardado, retry automático

## Constantes

```typescript
// src/queue/queue.constants.ts
export const UPLOAD_QUEUE = 'upload';

export interface UploadJobData {
  uploadJobId: string;
}
```

## Redis

Redis se usa para:
- **BullMQ**: colas de jobs
- **Cache**: Jikan API responses
- **Websocket**: pub/sub para eventos en tiempo real

## ScheduleModule

NestJS `ScheduleModule.forRoot()` habilitado para cron jobs si se necesitan en el futuro.
