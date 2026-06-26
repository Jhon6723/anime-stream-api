# Proveedores de Video

## Módulo: `providers`

Adapters para múltiples proveedores de video streaming. Patrón adapter con interfaz común `VideoProvider`.

## Proveedores Soportados

| Provider | Base URL | Presign | Remote Upload | Stream Upload |
|----------|----------|---------|---------------|---------------|
| Doodstream | `https://doodapi.co/api` | ✅ | ✅ | ✅ |
| Streamtape | `https://api.streamtape.com` | ✅ | ✅ | ❌ |
| MixDrop | `https://api.mixdrop.ag` | ❌ | ✅ | ✅ |

## Interfaz VideoProvider

```typescript
interface VideoProvider {
  readonly provider: Provider;

  uploadFile(filePath: string, apiKey: string): Promise<UploadResult>;
  streamUpload?(fileBuffer: Buffer, fileName: string, apiKey: string): Promise<UploadResult>;
  getUploadUrl?(apiKey: string): Promise<PresignResult>;
  remoteUpload(url: string, apiKey: string): Promise<RemoteUploadResult>;
  checkRemoteUpload(trackingId: string, apiKey: string): Promise<RemoteUploadStatus>;
  getFileInfo(providerFileId: string, apiKey: string): Promise<ProviderFileInfo>;
  deleteFile(providerFileId: string, apiKey: string): Promise<void>;
  buildEmbedUrl(providerFileId: string): string;
}
```

## ProviderFileInfo

```typescript
interface ProviderFileInfo {
  providerFileId: string;
  status: "UPLOADING" | "ENCODING" | "READY" | "ERROR" | "DELETED";
  views?: number;
}
```

## Gestión de Cuentas (ProviderAccount)

Las API keys se almacenan en la tabla `ProviderAccount` con encriptación AES.

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/providers` | ADMIN | Listar cuentas de proveedores |
| POST | `/api/providers` | ADMIN | Crear cuenta de proveedor |
| PATCH | `/api/providers/:id` | ADMIN | Actualizar cuenta |
| DELETE | `/api/providers/:id` | ADMIN | Eliminar cuenta |

### Encriptación

- Algoritmo: AES-256-GCM con scrypt para derivación de clave
- Clave: `ENCRYPTION_KEY` desde env vars
- Las API keys se encriptan antes de guardar y se desencriptan solo en uso interno
- Respuestas a cliente: API key masked (ej: `abc***xyz`)

### Prioridad

Cada `ProviderAccount` tiene un `priority` (int). Cuando se necesita una API key, se selecciona la cuenta activa con menor priority.

## ProviderRegistryService

Registro centralizado de adapters. Permite obtener el adapter correcto por provider:

```typescript
providerRegistry.get(Provider.DOODSTREAM) // → DoodstreamAdapter
```

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `video-provider.interface.ts` | Interfaz común |
| `provider-registry.service.ts` | Registro de adapters |
| `provider-account.service.ts` | Gestión de cuentas encriptadas |
| `provider-account.controller.ts` | CRUD de cuentas |
| `adapters/doodstream.adapter.ts` | Adapter Doodstream |
| `adapters/streamtape.adapter.ts` | Adapter Streamtape |
| `adapters/mixdrop.adapter.ts` | Adapter MixDrop |
| `providers.module.ts` | Configuración del módulo |
