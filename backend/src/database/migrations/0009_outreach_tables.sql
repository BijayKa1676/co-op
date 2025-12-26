-- Customer Discovery & Outreach Tables
-- Migration: 0009_outreach_tables.sql

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  
  -- Company info
  company_name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  industry VARCHAR(100),
  company_size VARCHAR(50),
  location VARCHAR(255),
  description TEXT,
  
  -- Contact info
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_title VARCHAR(255),
  linkedin_url VARCHAR(500),
  
  -- Metadata
  enrichment_data JSONB DEFAULT '{}',
  lead_score INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'new',
  source VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_user_id_idx ON leads(user_id);
CREATE INDEX IF NOT EXISTS leads_startup_id_idx ON leads(startup_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  subject_template VARCHAR(500) NOT NULL,
  body_template TEXT NOT NULL,
  
  status VARCHAR(50) DEFAULT 'draft',
  settings JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);

-- Campaign emails table
CREATE TABLE IF NOT EXISTS campaign_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  
  status VARCHAR(50) DEFAULT 'pending',
  
  tracking_id VARCHAR(100) UNIQUE,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS campaign_emails_campaign_id_idx ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_emails_lead_id_idx ON campaign_emails(lead_id);
CREATE INDEX IF NOT EXISTS campaign_emails_status_idx ON campaign_emails(status);
CREATE INDEX IF NOT EXISTS campaign_emails_tracking_id_idx ON campaign_emails(tracking_id);
