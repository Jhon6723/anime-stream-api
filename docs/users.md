# Gestión de Usuarios

## Módulo: `users`

Gestión de usuarios, roles y estados.

## Roles

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total, gestión de usuarios, config, hard delete |
| `MODERATOR` | Cola de moderación, acciones sobre episodios |
| `UPLOADER` | Upload de videos, gestión de sus uploads |

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
| PATCH | `/api/users/:id/status` | ADMIN | Cambiar estado (ACTIVE, SUSPENDED, BANNED) |

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
  role: "ADMIN" | "MODERATOR" | "UPLOADER";
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
- El admin crea cuentas de staff con `POST /users` (default: MODERATOR)
- El admin promueve a UPLOADER con `PATCH /users/:id/role`
- Passwords hasheadas con bcrypt (12 rounds)

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `users.controller.ts` | Endpoints REST |
| `users.service.ts` | Lógica de gestión de usuarios |
| `dto/create-user-by-admin.dto.ts` | DTO de creación por admin |
| `dto/update-user-role.dto.ts` | DTO de cambio de rol |
| `dto/update-user-status.dto.ts` | DTO de cambio de estado |
| `users.module.ts` | Configuración del módulo |
