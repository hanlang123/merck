import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const SettingsSchema = z.object({
  // ── LLM ──────────────────────────────────────────────────────────────────
  openaiApiKey: z.string().default(''),
  anthropicApiKey: z.string().default(''),
  defaultLlmProvider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
  defaultModel: z.string().default('gpt-4o-mini'),
  fallbackModel: z.string().default('gpt-4o-mini'),

  // ── Agent ─────────────────────────────────────────────────────────────────
  maxSteps: z.coerce.number().int().positive().default(30),
  maxRetries: z.coerce.number().int().positive().default(3),
  retryBaseDelayMs: z.coerce.number().positive().default(1000),

  // ── Redis ─────────────────────────────────────────────────────────────────
  redisUrl: z.string().default('redis://localhost:6379/0'),

  // ── Security ─────────────────────────────────────────────────────────────
  enableGuardrails: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  auditLogPath: z.string().default('./audit.log'),

  // ── Observability ─────────────────────────────────────────────────────────
  otlpEndpoint: z.string().default('http://localhost:4317'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  metricsPort: z.coerce.number().int().positive().default(9090),

  // ── Cost ─────────────────────────────────────────────────────────────────
  monthlyTokenBudget: z.coerce.number().int().positive().default(10_000_000),
  tokenAlertThreshold: z.coerce.number().min(0).max(1).default(0.8),
  semanticCacheTtlSeconds: z.coerce.number().int().positive().default(3600),
  semanticCacheSimilarity: z.coerce.number().min(0).max(1).default(0.95),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimitPerMinute: z.coerce.number().int().positive().default(60),
  rateLimitPerTenant: z.coerce.number().int().positive().default(20),
});

export type Settings = z.infer<typeof SettingsSchema>;

function loadSettings(): Settings {
  return SettingsSchema.parse({
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    defaultLlmProvider: process.env['DEFAULT_LLM_PROVIDER'],
    defaultModel: process.env['DEFAULT_MODEL'],
    fallbackModel: process.env['FALLBACK_MODEL'],
    maxSteps: process.env['MAX_STEPS'],
    maxRetries: process.env['MAX_RETRIES'],
    retryBaseDelayMs: process.env['RETRY_BASE_DELAY_MS'],
    redisUrl: process.env['REDIS_URL'],
    enableGuardrails: process.env['ENABLE_GUARDRAILS'],
    auditLogPath: process.env['AUDIT_LOG_PATH'],
    otlpEndpoint: process.env['OTLP_ENDPOINT'],
    logLevel: process.env['LOG_LEVEL'],
    metricsPort: process.env['METRICS_PORT'],
    monthlyTokenBudget: process.env['MONTHLY_TOKEN_BUDGET'],
    tokenAlertThreshold: process.env['TOKEN_ALERT_THRESHOLD'],
    semanticCacheTtlSeconds: process.env['SEMANTIC_CACHE_TTL_SECONDS'],
    semanticCacheSimilarity: process.env['SEMANTIC_CACHE_SIMILARITY'],
    rateLimitPerMinute: process.env['RATE_LIMIT_PER_MINUTE'],
    rateLimitPerTenant: process.env['RATE_LIMIT_PER_TENANT'],
  });
}

export const settings = loadSettings();
