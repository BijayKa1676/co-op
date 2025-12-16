-- Migration: Normalize array columns to junction tables
-- Created: 2025-12-16
-- Reason: PostgreSQL arrays can return null and cause frontend issues

-- =============================================
-- INVESTOR JUNCTION TABLES
-- =============================================

-- Investor sectors (many-to-many with predefined sectors)
CREATE TABLE IF NOT EXISTS investor_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    sector TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(investor_id, sector)
);

-- Investor regions (many-to-many with predefined regions)
CREATE TABLE IF NOT EXISTS investor_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(investor_id, region)
);

-- Investor portfolio companies
CREATE TABLE IF NOT EXISTS investor_portfolio_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(investor_id, company_name)
);

-- Investor notable exits
CREATE TABLE IF NOT EXISTS investor_notable_exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(investor_id, company_name)
);

-- Create indexes for investor junction tables
CREATE INDEX IF NOT EXISTS idx_investor_sectors_investor_id ON investor_sectors(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_regions_investor_id ON investor_regions(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_portfolio_investor_id ON investor_portfolio_companies(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_exits_investor_id ON investor_notable_exits(investor_id);

-- =============================================
-- ALERT JUNCTION TABLES
-- =============================================

-- Alert keywords
CREATE TABLE IF NOT EXISTS alert_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(alert_id, keyword)
);

-- Alert competitors
CREATE TABLE IF NOT EXISTS alert_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    competitor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(alert_id, competitor)
);

-- Alert result matched keywords
CREATE TABLE IF NOT EXISTS alert_result_matched_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_result_id UUID NOT NULL REFERENCES alert_results(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(alert_result_id, keyword)
);

-- Create indexes for alert junction tables
CREATE INDEX IF NOT EXISTS idx_alert_keywords_alert_id ON alert_keywords(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_competitors_alert_id ON alert_competitors(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_result_keywords_result_id ON alert_result_matched_keywords(alert_result_id);

-- =============================================
-- MIGRATE EXISTING DATA
-- =============================================

-- Migrate investor sectors
INSERT INTO investor_sectors (investor_id, sector)
SELECT id, unnest(sectors) FROM investors WHERE sectors IS NOT NULL AND array_length(sectors, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate investor regions
INSERT INTO investor_regions (investor_id, region)
SELECT id, unnest(regions) FROM investors WHERE regions IS NOT NULL AND array_length(regions, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate investor portfolio companies
INSERT INTO investor_portfolio_companies (investor_id, company_name)
SELECT id, unnest(portfolio_companies) FROM investors WHERE portfolio_companies IS NOT NULL AND array_length(portfolio_companies, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate investor notable exits
INSERT INTO investor_notable_exits (investor_id, company_name)
SELECT id, unnest(notable_exits) FROM investors WHERE notable_exits IS NOT NULL AND array_length(notable_exits, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate alert keywords
INSERT INTO alert_keywords (alert_id, keyword)
SELECT id, unnest(keywords) FROM alerts WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate alert competitors
INSERT INTO alert_competitors (alert_id, competitor)
SELECT id, unnest(competitors) FROM alerts WHERE competitors IS NOT NULL AND array_length(competitors, 1) > 0
ON CONFLICT DO NOTHING;

-- Migrate alert result matched keywords
INSERT INTO alert_result_matched_keywords (alert_result_id, keyword)
SELECT id, unnest(matched_keywords) FROM alert_results WHERE matched_keywords IS NOT NULL AND array_length(matched_keywords, 1) > 0
ON CONFLICT DO NOTHING;

-- =============================================
-- DROP OLD ARRAY COLUMNS (after data migration)
-- =============================================

ALTER TABLE investors DROP COLUMN IF EXISTS sectors;
ALTER TABLE investors DROP COLUMN IF EXISTS regions;
ALTER TABLE investors DROP COLUMN IF EXISTS portfolio_companies;
ALTER TABLE investors DROP COLUMN IF EXISTS notable_exits;

ALTER TABLE alerts DROP COLUMN IF EXISTS keywords;
ALTER TABLE alerts DROP COLUMN IF EXISTS competitors;

ALTER TABLE alert_results DROP COLUMN IF EXISTS matched_keywords;
