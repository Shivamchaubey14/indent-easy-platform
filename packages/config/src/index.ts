import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v));
const commaList = z.string().transform((v) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/**
 * Access-token signing keys: comma-separated `kid:<base64 PKCS#8 DER>` ES256 (P-256) private keys.
 * The first signs new tokens; all of them verify, so a new key can be added before the old one
 * is retired (SRS §30.1).
 */
const signingKeys = optionalText.pipe(
  z
    .string()
    .regex(/^[\w-]{1,32}:[A-Za-z0-9+/]+={0,2}(,[\w-]{1,32}:[A-Za-z0-9+/]+={0,2})*$/, {
      message: 'expected kid:<base64 PKCS#8 key>[,kid:<key>...]',
    })
    .transform((value) =>
      value.split(',').map((entry) => {
        const [kid = '', pkcs8] = entry.split(':');
        return { kid, pkcs8: pkcs8 ?? '' };
      }),
    )
    .optional(),
);

/** Raw environment contract (SRS §55.2). Names match the variables exactly. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'dev', 'qa', 'staging', 'prod']).default('local'),
    PORT: port.default(8080),
    METRICS_PORT: port.default(9464),
    PUBLIC_BASE_URL: z.url(),
    CORS_ALLOWED_ORIGINS: commaList,

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DATABASE_READ_URL: optionalText.pipe(z.url({ protocol: /^postgres(ql)?$/ }).optional()),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),

    S3_ENDPOINT: optionalText.pipe(z.url().optional()),
    S3_REGION: z.string().min(1).default('ap-south-1'),
    S3_BUCKET_DOCUMENTS: z.string().min(3),
    S3_BUCKET_EXPORTS: z.string().min(3),
    S3_BUCKET_IMPORTS: z.string().min(3),
    S3_BUCKET_QUARANTINE: z.string().min(3),
    S3_ACCESS_KEY_ID: optionalText,
    S3_SECRET_ACCESS_KEY: optionalText,

    JWT_SIGNING_KEYS: signingKeys,
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    CSRF_SECRET: optionalText,
    // `hibp` checks new passwords against Have I Been Pwned's k-anonymity range API (only a
    // 5-character hash prefix leaves the server); `off` skips the check (tests, air-gapped hosts).
    PASSWORD_BREACH_CHECK: z.enum(['hibp', 'off']).default('hibp'),

    SMTP_HOST: z.string().min(1),
    SMTP_PORT: port.default(587),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    MAIL_FROM: z.string().min(3),

    SMS_PROVIDER: z.string().min(1).default('console'),
    SMS_API_KEY: optionalText,
    SMS_SENDER_ID: optionalText,
    SMS_DLT_ENTITY_ID: optionalText,

    GOTENBERG_URL: optionalText.pipe(z.url().optional()),
    DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
    GRAPHQL_MAX_DEPTH: z.coerce.number().int().min(1).default(10),
    GRAPHQL_MAX_COST: z.coerce.number().int().min(1).default(5000),
    GRAPHQL_PERSISTED_ONLY: flag.default(true),
    GRAPHQL_INTROSPECTION: flag.default(false),
    // Worker process: which event consumers this deployment runs (comma list); unset = all.
    WORKER_CONSUMERS: optionalText.transform((v) =>
      v
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.CORS_ALLOWED_ORIGINS.some((o) => o.includes('*'))) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'wildcards are not allowed',
      });
    }
    const deployed = env.APP_ENV === 'staging' || env.APP_ENV === 'prod';
    if (!deployed) return;
    for (const key of ['JWT_SIGNING_KEYS', 'CSRF_SECRET'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: `required in ${env.APP_ENV}` });
    }
    if (env.GRAPHQL_INTROSPECTION) {
      ctx.addIssue({
        code: 'custom',
        path: ['GRAPHQL_INTROSPECTION'],
        message: `must be false in ${env.APP_ENV}`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function toConfig(env: Env) {
  return {
    nodeEnv: env.NODE_ENV,
    appEnv: env.APP_ENV,
    http: {
      port: env.PORT,
      metricsPort: env.METRICS_PORT,
      publicBaseUrl: env.PUBLIC_BASE_URL,
      corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
    },
    database: {
      url: env.DATABASE_URL,
      readUrl: env.DATABASE_READ_URL,
      poolMax: env.DATABASE_POOL_MAX,
    },
    redis: { url: env.REDIS_URL },
    storage: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      buckets: {
        documents: env.S3_BUCKET_DOCUMENTS,
        exports: env.S3_BUCKET_EXPORTS,
        imports: env.S3_BUCKET_IMPORTS,
        quarantine: env.S3_BUCKET_QUARANTINE,
      },
    },
    auth: {
      jwtSigningKeys: env.JWT_SIGNING_KEYS,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      csrfSecret: env.CSRF_SECRET,
      breachCheck: env.PASSWORD_BREACH_CHECK,
    },
    mail: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    },
    sms: {
      provider: env.SMS_PROVIDER,
      apiKey: env.SMS_API_KEY,
      senderId: env.SMS_SENDER_ID,
      dltEntityId: env.SMS_DLT_ENTITY_ID,
    },
    pdf: { gotenbergUrl: env.GOTENBERG_URL },
    timezone: env.DEFAULT_TIMEZONE,
    worker: { consumers: env.WORKER_CONSUMERS },
    graphql: {
      maxDepth: env.GRAPHQL_MAX_DEPTH,
      maxCost: env.GRAPHQL_MAX_COST,
      persistedOnly: env.GRAPHQL_PERSISTED_ONLY,
      introspection: env.GRAPHQL_INTROSPECTION,
    },
  };
}

export type AppConfig = ReturnType<typeof toConfig>;

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Validates the environment and returns typed configuration, or throws a ConfigError
 * naming every bad variable. Values are never echoed, because many of them are secrets.
 */
export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return toConfig(result.data);
}
