import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  port: parseInt(optionalEnv('PORT', '3001'), 10),

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  worker: {
    concurrency: parseInt(optionalEnv('WORKER_CONCURRENCY', '5'), 10),
    rateLimiterMax: parseInt(optionalEnv('RATE_LIMITER_MAX', '10'), 10),
    minDelayBetweenSendsMs: parseInt(
      optionalEnv('MIN_DELAY_BETWEEN_SENDS_MS', '1000'),
      10,
    ),
  },

  rateLimit: {
    maxEmailsPerHourPerSender: parseInt(
      optionalEnv('MAX_EMAILS_PER_HOUR_PER_SENDER', '100'),
      10,
    ),
    maxEmailsPerHourGlobal: parseInt(
      optionalEnv('MAX_EMAILS_PER_HOUR_GLOBAL', '500'),
      10,
    ),
  },

  nodeEnv: optionalEnv('NODE_ENV', 'development'),
} as const;
