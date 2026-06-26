# Autenticación

## Módulo: `auth`

Sistema de autenticación basado en JWT con access token y refresh token.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Público | Iniciar sesión, retorna access + refresh token |
| POST | `/api/auth/refresh` | Público | Renovar access token usando refresh token |
| POST | `/api/auth/logout` | JWT | Invalidar refresh token |
| GET | `/api/auth/me` | JWT | Obtener datos del usuario autenticado |

## DTOs

### LoginDto
```typescript
{
  email: string;
  password: string;
}
```

### RefreshTokenDto
```typescript
{
  refreshToken: string;
}
```

## Flujo de Autenticación

1. **Login**: `POST /auth/login` → retorna `{ accessToken, refreshToken, user }`
2. **Refresh**: `POST /auth/refresh` → nuevo `accessToken` desde `refreshToken` válido
3. **Logout**: `POST /auth/logout` → invalida el `refreshToken` en DB/Redis
4. **Me**: `GET /auth/me` → retorna datos del usuario desde el JWT

## Tokens JWT

| Token | Expiración | Secret |
|-------|-----------|--------|
| Access | 15m (configurable) | `JWT_ACCESS_SECRET` |
| Refresh | 7d (configurable) | `JWT_REFRESH_SECRET` |

## Seguridad

- Passwords hasheadas con **bcrypt** (12 rounds)
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`
- Rate limiting global: 120 req/min
- Guards: `JwtAuthGuard` (global), `RolesGuard` (por endpoint)

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `auth.controller.ts` | Endpoints REST |
| `auth.service.ts` | Lógica de login, refresh, logout |
| `auth.module.ts` | Configuración del módulo |
| `dto/login.dto.ts` | DTO de login |
| `dto/refresh-token.dto.ts` | DTO de refresh |
| `strategies/jwt.strategy.ts` | Estrategia JWT para Passport |
