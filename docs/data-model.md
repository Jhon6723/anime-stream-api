# Modelo de Datos

## Prisma Schema

Base de datos: **PostgreSQL**. ORM: **Prisma 6**.

## Enums

### UserRole
`ADMIN` | `MODERATOR` | `UPLOADER`

### UserStatus
`ACTIVE` | `SUSPENDED` | `BANNED`

### AnimeStatus
`ONGOING` | `COMPLETED` | `UPCOMING`

### AnimeType
`TV` | `MOVIE` | `OVA` | `ONA` | `SPECIAL`

### ModerationStatus
`PENDING` | `APPROVED` | `WARNED` | `DISABLED`

### ModerationAction
`APPROVE` | `WARNING` | `DISABLE` | `RE_ENABLE` | `HARD_DELETE`

### Provider
`DOODSTREAM` | `MIXDROP` | `STREAMTAPE`

### VideoSourceStatus
`UPLOADING` | `ENCODING` | `READY` | `ERROR` | `DELETED`

### SubtitleLanguage
`EN` | `ES`

### UploadSourceType
`LOCAL` | `REMOTE_URL`

### UploadJobStatus
`QUEUED` | `UPLOADING` | `PROCESSING` | `COMPLETED` | `FAILED`

### AdProvider
`ADSENSE` | `CUSTOM`

### AdPlacement
`HEADER` | `SIDEBAR` | `IN_PLAYER` | `FOOTER`

### UploaderRequestStatus
~~Eliminado~~

### SystemConfigCategory
`SEO` | `MODERATION` | `GENERAL`

## Modelos

### User
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| email | String | Unique |
| username | String | Unique |
| passwordHash | String | bcrypt (12 rounds) |
| role | UserRole | Default: USER |
| status | UserStatus | Default: ACTIVE |
| approvedById | String? | FK → User (self-ref) |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### Anime
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| title | String | |
| slug | String | Unique |
| synopsis | String? | |
| coverImage | String? | URL |
| bannerImage | String? | URL |
| status | AnimeStatus | Default: ONGOING |
| type | AnimeType | Default: TV |
| genres | String[] | |
| studios | String[] | |
| totalEpisodes | Int? | |
| releaseDate | DateTime? | |
| isEnabled | Boolean | Default: true |
| jikanId | Int? | Unique, MAL ID |
| isTitleLocked | Boolean | Default: false |
| createdById | String? | FK → User |
| updatedById | String? | FK → User |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Relaciones**: `Episode[]`, `ModerationLog[]`

### Episode
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| animeId | String | FK → Anime (Cascade) |
| episodeNumber | Int | |
| title | String? | |
| description | String? | |
| thumbnailUrl | String? | |
| duration | Int? | Segundos |
| isEnabled | Boolean | Default: true |
| moderationStatus | ModerationStatus | Default: PENDING |
| jikanEpisodeId | Int? | |
| isFiller | Boolean | Default: false |
| airedDate | DateTime? | |
| createdById | String? | FK → User |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Unique**: `(animeId, episodeNumber)`
**Relaciones**: `VideoSource[]`, `UploadJob[]`, `ModerationLog[]`

### VideoSource
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| episodeId | String | FK → Episode (Cascade) |
| provider | Provider | |
| language | SubtitleLanguage | Default: EN |
| providerFileId | String? | ID en el provider |
| embedUrl | String? | |
| downloadUrl | String? | |
| remoteTrackingId | String? | |
| status | VideoSourceStatus | Default: UPLOADING |
| isActive | Boolean | Default: true |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Unique**: `(episodeId, provider, language)`
**Relaciones**: `UploadJob[]`, `BrokenLinkReport[]`

### ModerationLog
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| animeId | String? | FK → Anime |
| episodeId | String? | FK → Episode |
| moderatorId | String | FK → User |
| action | ModerationAction | |
| reason | String | Obligatorio |
| notes | String? | |
| createdAt | DateTime | Auto |

### UploadJob
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| episodeId | String | FK → Episode (Cascade) |
| videoSourceId | String? | FK → VideoSource |
| provider | Provider | |
| language | SubtitleLanguage | Default: EN |
| sourceType | UploadSourceType | |
| sourceUrl | String? | |
| status | UploadJobStatus | Default: QUEUED |
| retryCount | Int | Default: 0 |
| errorMessage | String? | |
| initiatedById | String | FK → User |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### ProviderAccount
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| provider | Provider | |
| label | String | Etiqueta descriptiva |
| apiKey | String | Encriptado AES-256-GCM |
| isActive | Boolean | Default: true |
| priority | Int | Default: 0 (menor = mayor prioridad) |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### AdConfig
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| provider | AdProvider | |
| adCode | String | |
| placement | AdPlacement | |
| isActive | Boolean | Default: true |
| updatedById | String? | FK → User |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### UploaderRequest
~~Eliminado~~ — El admin asigna roles directamente con `PATCH /users/:id/role`.

### BrokenLinkReport
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| videoSourceId | String | FK → VideoSource (Cascade) |
| ipAddress | String | |
| userAgent | String? | |
| createdAt | DateTime | Auto |

### SystemConfig
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (UUID) | PK |
| key | String | Unique (ej: "seo.title") |
| value | String | Encriptado si isSensitive |
| isSensitive | Boolean | Default: false |
| category | SystemConfigCategory | Default: GENERAL |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

## Diagrama de Relaciones

```
User ──┬──< Anime ──< Episode ──< VideoSource
       │         │         │
       │         │         ├──< UploadJob
       │         │         └──< BrokenLinkReport
       │         │
       │         └──< ModerationLog
       │
       ├──< UploadJob
       ├──< AdConfig
       ├──< UploaderRequest
       └──< ModerationLog

ProviderAccount (independiente, encriptado)
SystemConfig (independiente, encriptado si sensible)
```
