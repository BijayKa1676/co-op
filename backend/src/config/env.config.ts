import { z } from 'zod';

/**
 * Environment configuration schema with validation
 * 
 * SECURITY NOTES:
 * - ENCRYPTION_KEY is REQUIRED in production for AES-256-GCM encryption
 * - At least 2 LLM API keys are required for council cross-critique
 * - MASTER_API_KEY should be set for service-to-service authentication
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  API_PREFIX: z.string().default('api/v1'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Supabase
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('documents'),

  // Upstash Redis - REST API (for @upstash/redis caching)
  UPSTASH_REDIS_URL: z.string().min(1, 'UPSTASH_REDIS_URL is required'),
  UPSTASH_REDIS_TOKEN: z.string().min(1, 'UPSTASH_REDIS_TOKEN is required'),

  // Upstash QStash (serverless queue)
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  QSTASH_CALLBACK_URL: z.string().optional(), // Auto-detected on Render, set for local dev

  // LLM Providers (configure at least 2 for council cross-critique)
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),

  // Web Search Fallback (optional - ScrapingBee)
  SCRAPINGBEE_API_KEY: z.string().optional(),

  // LLM Council settings (minimum 2 required for cross-critique)
  LLM_COUNCIL_MIN_MODELS: z.string().default('2').transform(Number),
  LLM_COUNCIL_MAX_MODELS: z.string().default('3').transform(Number),

  // Notion Integration (optional - internal integration)
  NOTION_API_TOKEN: z.string().optional(),
  NOTION_DEFAULT_PAGE_ID: z.string().optional(),

  // RAG Service (for legal/finance agents)
  RAG_SERVICE_URL: z.string().optional(),
  RAG_API_KEY: z.string().optional(),

  // API Keys
  MASTER_API_KEY: z.string().optional(),

  // Encryption (for sensitive data at rest)
  // CRITICAL: Required in production for AES-256-GCM encryption
  ENCRYPTION_KEY: z.string().optional(),

  // Rate limiting
  THROTTLE_TTL: z.string().default('60').transform(Number),
  THROTTLE_LIMIT: z.string().default('100').transform(Number),

  // Pilot program limits (configurable for scaling)
  // Agent/Chat limits
  PILOT_AGENT_MONTHLY_REQUESTS: z.string().default('3').transform(Number),
  // API key limits
  PILOT_API_KEY_LIMIT: z.string().default('1').transform(Number),
  PILOT_API_KEY_MONTHLY_REQUESTS: z.string().default('3').transform(Number),
  // Webhook limits
  PILOT_WEBHOOK_LIMIT: z.string().default('1').transform(Number),
  PILOT_WEBHOOK_DAILY_TRIGGERS: z.string().default('10').transform(Number),
  // Alert limits
  PILOT_ALERT_LIMIT: z.string().default('3').transform(Number),
  // Outreach limits
  PILOT_LEAD_LIMIT: z.string().default('50').transform(Number),
  PILOT_LEAD_DISCOVERY_HOURLY: z.string().default('5').transform(Number),
  PILOT_CAMPAIGN_LIMIT: z.string().default('5').transform(Number),
  PILOT_EMAILS_PER_DAY: z.string().default('50').transform(Number),

  // CORS
  CORS_ORIGINS: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),

  // SendGrid Email
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().default('noreply@co-op.ai'),
  SENDGRID_FROM_NAME: z.string().default('Co-Op AI'),
  SENDGRID_WEBHOOK_SECRET: z.string().optional(),

  // App URL (for tracking links)
  APP_URL: z.string().default('http://localhost:3000'),
}).refine(
  (data) => {
    // In production, ENCRYPTION_KEY is required
    if (data.NODE_ENV === 'production' && !data.ENCRYPTION_KEY) {
      return false;
    }
    return true;
  },
  {
    message: 'ENCRYPTION_KEY is required in production for secure data encryption',
    path: ['ENCRYPTION_KEY'],
  }
).refine(
  (data) => {
    // Ensure at least 2 LLM providers are configured for council
    const providers = [data.GROQ_API_KEY, data.GOOGLE_AI_API_KEY, data.HUGGINGFACE_API_KEY].filter(Boolean);
    return providers.length >= 2;
  },
  {
    message: 'At least 2 LLM API keys are required for council cross-critique (GROQ_API_KEY, GOOGLE_AI_API_KEY, HUGGINGFACE_API_KEY)',
    path: ['GROQ_API_KEY'],
  }
);

export type EnvConfig = z.infer<typeof envSchema>;
