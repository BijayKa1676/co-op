import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';

/**
 * User settings for status management and admin notes.
 * Usage tracking is handled via Redis (pilot limits).
 * Separate from users table to avoid bloating the main user record.
 */
export const userSettings = pgTable(
  'user_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
    
    // Status
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, suspended
    suspendedAt: timestamp('suspended_at'),
    suspendedReason: varchar('suspended_reason', { length: 500 }),
    
    // Admin notes
    adminNotes: varchar('admin_notes', { length: 1000 }),
    
    // Activity tracking
    lastActiveAt: timestamp('last_active_at'),
    
    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_settings_user_id_idx').on(table.userId),
    index('user_settings_status_idx').on(table.status),
  ],
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

/**
 * Pilot plan limits - these are the DEFAULT limits enforced via Redis
 * Actual limits are configurable via environment variables:
 * - PILOT_AGENT_MONTHLY_REQUESTS (default: 3)
 * - PILOT_API_KEY_LIMIT (default: 1)
 * - PILOT_API_KEY_MONTHLY_REQUESTS (default: 3)
 * - PILOT_WEBHOOK_LIMIT (default: 1)
 * - PILOT_WEBHOOK_DAILY_TRIGGERS (default: 10)
 * - PILOT_LEAD_LIMIT (default: 50)
 * - PILOT_LEAD_DISCOVERY_HOURLY (default: 5)
 * - PILOT_CAMPAIGN_LIMIT (default: 5)
 * - PILOT_EMAILS_PER_DAY (default: 50)
 * 
 * Admin can view and reset usage, but limits are code/env-defined
 */
export const PILOT_LIMITS = {
  agentRequests: { limit: 3, period: 'month', key: 'usage', envVar: 'PILOT_AGENT_MONTHLY_REQUESTS' },
  apiKeys: { limit: 1, period: 'total', envVar: 'PILOT_API_KEY_LIMIT' },
  apiKeyRequests: { limit: 3, period: 'month', envVar: 'PILOT_API_KEY_MONTHLY_REQUESTS' },
  webhooks: { limit: 1, period: 'total', envVar: 'PILOT_WEBHOOK_LIMIT' },
  webhookTriggers: { limit: 10, period: 'day', envVar: 'PILOT_WEBHOOK_DAILY_TRIGGERS' },
  alerts: { limit: 3, period: 'total', envVar: 'PILOT_ALERT_LIMIT' },
  leads: { limit: 50, period: 'total', envVar: 'PILOT_LEAD_LIMIT' },
  leadDiscovery: { limit: 5, period: 'hour', envVar: 'PILOT_LEAD_DISCOVERY_HOURLY' },
  campaigns: { limit: 5, period: 'total', envVar: 'PILOT_CAMPAIGN_LIMIT' },
  emailsPerDay: { limit: 50, period: 'day', envVar: 'PILOT_EMAILS_PER_DAY' },
} as const;

export type PilotLimitType = keyof typeof PILOT_LIMITS;
