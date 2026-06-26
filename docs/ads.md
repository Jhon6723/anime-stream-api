# Anuncios (Ads)

## Módulo: `ads`

Gestión de configuración de anuncios. Soporta AdSense y códigos personalizados con placements específicos.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ads/active` | Público | Listar anuncios activos (para frontend) |
| GET | `/api/ads` | ADMIN | Listar todas las configs de anuncios |

## Modelo AdConfig

```typescript
{
  id: string;
  provider: "ADSENSE" | "CUSTOM";
  adCode: string;        // código del anuncio (script, ID, etc.)
  placement: "HEADER" | "SIDEBAR" | "IN_PLAYER" | "FOOTER";
  isActive: boolean;
  updatedById?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Placements

| Placement | Ubicación |
|-----------|-----------|
| `HEADER` | Cabecera del sitio |
| `SIDEBAR` | Barra lateral |
| `IN_PLAYER` | Dentro del reproductor |
| `FOOTER` | Pie de página |

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `ads.controller.ts` | Endpoints REST |
| `ads.service.ts` | Lógica de gestión |
| `ads.module.ts` | Configuración del módulo |
