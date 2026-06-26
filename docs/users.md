# Gestión de Usuarios

## Módulo: `users`

Gestión de usuarios, roles, estados y solicitudes de uploader.

## Roles

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total, gestión de usuarios, config, hard delete |
| `MODERATOR` | Cola de moderación, acciones sobre episodios |
| `UPLOADER` | Upload de videos, gestión de sus uploads |
| `USER` | Solo lectura del catálogo público |

## Estados de Usuario

| Estado | Descripción |
|--------|-------------|
| `ACTIVE` | Usuario activo |
| `SUSPENDED` | Suspendido temporalmente |
| `BANNED` | Baneado permanentemente |

## Endpoints — Usuarios

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/users` | ADMIN | Listar todos los usuarios |
| POST | `/api/users` | ADMIN | Crear usuario (por admin) |
| GET | `/api/users/:id` | ADMIN | Detalle de un usuario |
| PATCH | `/api/users/:id/role` | ADMIN | Cambiar rol de un usuario |
| POST | `/api/users/:id/approve-uploader` | ADMIN | Aprobar como uploader directo |
| PATCH | `/api/users/:id/status` | ADMIN | Cambiar estado (ACTIVE, SUSPENDED, BANNED) |

## Endpoints — Uploader Requests

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/users/me/uploader-request` | USER | Solicitar rol uploader |
| GET | `/api/users/uploader-requests` | ADMIN | Listar solicitudes pendientes |
| POST | `/api/users/uploader-requests/:id/approve` | ADMIN | Aprobar solicitud |
| POST | `/api/users/uploader-requests/:id/reject` | ADMIN | Rechazar solicitud |

## DTOs

### CreateUserByAdminDto
```typescript
{
  email: string;
  username: string;
  password: string;
  role?: UserRole;  // default: MODERATOR
}
```

### UpdateUserRoleDto
```typescript
{
  role: "ADMIN" | "MODERATOR" | "UPLOADER" | "USER";
}
```

### UpdateUserStatusDto
```typescript
{
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
}
```

## Reglas de Negocio

- No se puede cambiar el propio rol ni el propio estado
- Solo usuarios con rol `USER` pueden solicitar uploader
- No se pueden tener múltiples solicitudes pendientes simultáneas
- Al aprobar una solicitud, el usuario pasa a `UPLOADER` y se registra `approvedById`
- Passwords hasheadas con bcrypt (12 rounds)

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `users.controller.ts` | Endpoints REST |
| `users.service.ts` | Lógica de gestión de usuarios |
| `uploader-requests.service.ts` | Lógica de solicitudes de uploader |
| `dto/create-user-by-admin.dto.ts` | DTO de creación por admin |
| `dto/update-user-role.dto.ts` | DTO de cambio de rol |
| `dto/update-user-status.dto.ts` | DTO de cambio de estado |
| `users.module.ts` | Configuración del módulo |
