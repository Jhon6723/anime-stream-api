export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  databaseUrl: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  jikan: {
    baseUrl: string;
    cacheTtlSeconds: number;
    maxRequestsPerSecond: number;
  };
  providers: {
    doodstream: { apiKey?: string; baseUrl: string };
    mixdrop: { apiKey?: string; email?: string; baseUrl: string };
    streamtape: { login?: string; apiKey?: string; baseUrl: string };
  };
  syncStatsCron: string;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  jikan: {
    baseUrl: process.env.JIKAN_BASE_URL ?? 'https://api.jikan.moe/v4',
    cacheTtlSeconds: parseInt(process.env.JIKAN_CACHE_TTL ?? '86400', 10),
    maxRequestsPerSecond: parseInt(process.env.JIKAN_MAX_RPS ?? '3', 10),
  },
  providers: {
    doodstream: {
      apiKey: process.env.DOODSTREAM_API_KEY,
      baseUrl: process.env.DOODSTREAM_BASE_URL ?? 'https://doodapi.com/api',
    },
    mixdrop: {
      apiKey: process.env.MIXDROP_API_KEY,
      email: process.env.MIXDROP_EMAIL,
      baseUrl: process.env.MIXDROP_BASE_URL ?? 'https://api.mixdrop.co/api',
    },
    streamtape: {
      login: process.env.STREAMTAPE_LOGIN,
      apiKey: process.env.STREAMTAPE_API_KEY,
      baseUrl: process.env.STREAMTAPE_BASE_URL ?? 'https://api.streamtape.com',
    },
  },
  syncStatsCron: process.env.SYNC_STATS_CRON ?? '0 */6 * * *',
});
