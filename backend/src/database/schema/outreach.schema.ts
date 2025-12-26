import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { startups } from './startups.schema';

// Lead status enum values
export const LEAD_STATUSES = ['new', 'enriched', 'contacted', 'replied', 'converted', 'unsubscribed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Campaign status enum values
export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// Email status enum values
export const EMAIL_STATUSES = ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/**
 * Leads table - stores discovered potential customers
 */
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startupId: uuid('startup_id').notNull().references(() => startups.id, { onDelete: 'cascade' }),
  
  // Company info
  companyName: varchar('company_name', { length: 255 }).notNull(),
  website: varchar('website', { length: 500 }),
  industry: varchar('industry', { length: 100 }),
  companySize: varchar('company_size', { length: 50 }),
  location: varchar('location', { length: 255 }),
  description: text('description'),
  
  // Contact info
  contactName: varchar('contact_name', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactTitle: varchar('contact_title', { length: 255 }),
  linkedinUrl: varchar('linkedin_url', { length: 500 }),
  
  // Metadata
  enrichmentData: jsonb('enrichment_data').default({}),
  leadScore: integer('lead_score').default(0),
  status: varchar('status', { length: 50 }).default('new').$type<LeadStatus>(),
  source: varchar('source', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leads_user_id_idx').on(table.userId),
  index('leads_startup_id_idx').on(table.startupId),
  index('leads_status_idx').on(table.status),
]);

/**
 * Campaigns table - stores email campaign configurations
 */
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startupId: uuid('startup_id').notNull().references(() => startups.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 255 }).notNull(),
  subjectTemplate: varchar('subject_template', { length: 500 }).notNull(),
  bodyTemplate: text('body_template').notNull(),
  
  status: varchar('status', { length: 50 }).default('draft').$type<CampaignStatus>(),
  
  // Settings
  settings: jsonb('settings').default({}).$type<{
    trackOpens?: boolean;
    trackClicks?: boolean;
    dailyLimit?: number;
    sendingSchedule?: 'immediate' | 'scheduled';
    scheduledTime?: string;
  }>(),
  
  // Stats (denormalized for quick access)
  stats: jsonb('stats').default({}).$type<{
    totalEmails?: number;
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    replied?: number;
  }>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('campaigns_user_id_idx').on(table.userId),
  index('campaigns_status_idx').on(table.status),
]);

/**
 * Campaign emails table - individual emails in a campaign
 */
export const campaignEmails = pgTable('campaign_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  
  status: varchar('status', { length: 50 }).default('pending').$type<EmailStatus>(),
  
  // Tracking
  trackingId: varchar('tracking_id', { length: 100 }).unique(),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  bouncedAt: timestamp('bounced_at'),
  
  // Error info
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('campaign_emails_campaign_id_idx').on(table.campaignId),
  index('campaign_emails_lead_id_idx').on(table.leadId),
  index('campaign_emails_status_idx').on(table.status),
  index('campaign_emails_tracking_id_idx').on(table.trackingId),
]);

// Type exports for use in services
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignEmail = typeof campaignEmails.$inferSelect;
export type NewCampaignEmail = typeof campaignEmails.$inferInsert;
