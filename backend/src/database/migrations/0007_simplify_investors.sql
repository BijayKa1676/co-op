-- Migration: Simplify investors table to single table with comma-separated strings
-- Created: 2025-12-16
-- Reason: Remove junction tables complexity, use simple comma-separated strings

-- Step 1: Add new columns if they don't exist (for fresh installs)
-- These will store comma-separated values instead of using junction tables

-- Check if sectors column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investors' AND column_name = 'sectors' AND data_type = 'text') THEN
        ALTER TABLE investors ADD COLUMN sectors TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Check if regions column exists, if not add it  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investors' AND column_name = 'regions' AND data_type = 'text') THEN
        ALTER TABLE investors ADD COLUMN regions TEXT;
    END IF;
END $$;

-- Step 2: Migrate data from junction tables to comma-separated strings (if junction tables exist)

-- Migrate sectors
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investor_sectors') THEN
        UPDATE investors i
        SET sectors = COALESCE((
            SELECT string_agg(sector, ',')
            FROM investor_sectors
            WHERE investor_id = i.id
        ), '');
    END IF;
END $$;

-- Migrate regions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investor_regions') THEN
        UPDATE investors i
        SET regions = (
            SELECT string_agg(region, ',')
            FROM investor_regions
            WHERE investor_id = i.id
        );
    END IF;
END $$;

-- Step 3: Drop junction tables (they're no longer needed)
DROP TABLE IF EXISTS investor_sectors CASCADE;
DROP TABLE IF EXISTS investor_regions CASCADE;
DROP TABLE IF EXISTS investor_portfolio_companies CASCADE;
DROP TABLE IF EXISTS investor_notable_exits CASCADE;

-- Step 4: Drop old array columns if they exist (from original migration)
ALTER TABLE investors DROP COLUMN IF EXISTS portfolio_companies;
ALTER TABLE investors DROP COLUMN IF EXISTS notable_exits;

-- Step 5: Ensure sectors has a default for existing rows with empty values
UPDATE investors SET sectors = 'saas' WHERE sectors IS NULL OR sectors = '';
