-- Migration: Pitch Deck Analyzer & Cap Table Simulator
-- Version: 1.6.0

-- ============================================
-- PITCH DECK ANALYSIS
-- ============================================

CREATE TABLE IF NOT EXISTS pitch_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,
    
    -- File info
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER DEFAULT 0,
    
    -- Analysis status
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, failed
    
    -- Analysis results (JSONB for flexibility)
    analysis JSONB DEFAULT '{}',
    -- Structure: {
    --   overallScore: number (0-100),
    --   sections: { problem: {...}, solution: {...}, market: {...}, ... },
    --   strengths: string[],
    --   weaknesses: string[],
    --   suggestions: string[],
    --   investorFit: { vc: number, angel: number, corporate: number },
    --   sectorBenchmark: { percentile: number, avgScore: number }
    -- }
    
    -- Extracted content
    extracted_text TEXT,
    slide_summaries JSONB DEFAULT '[]', -- Array of { slideNumber, title, content, type }
    
    -- Metadata
    investor_type VARCHAR(50), -- vc, angel, corporate (for tailored analysis)
    target_raise VARCHAR(100), -- e.g., "$500K-$1M"
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_pitch_decks_user_id ON pitch_decks(user_id);
CREATE INDEX idx_pitch_decks_startup_id ON pitch_decks(startup_id);
CREATE INDEX idx_pitch_decks_status ON pitch_decks(status);
CREATE INDEX idx_pitch_decks_created_at ON pitch_decks(created_at DESC);

-- ============================================
-- CAP TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cap_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,
    
    name VARCHAR(255) NOT NULL DEFAULT 'Main Cap Table',
    description TEXT,
    
    -- Company info
    company_name VARCHAR(255) NOT NULL,
    incorporation_date DATE,
    authorized_shares BIGINT NOT NULL DEFAULT 10000000, -- Total authorized shares
    
    -- Current state
    total_issued_shares BIGINT NOT NULL DEFAULT 0,
    fully_diluted_shares BIGINT NOT NULL DEFAULT 0, -- Including options pool
    
    -- Valuation
    current_valuation DECIMAL(20, 2),
    price_per_share DECIMAL(20, 6),
    
    -- Options pool
    options_pool_size BIGINT DEFAULT 0,
    options_pool_allocated BIGINT DEFAULT 0,
    
    -- Metadata
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_tables_user_id ON cap_tables(user_id);
CREATE INDEX idx_cap_tables_startup_id ON cap_tables(startup_id);

-- ============================================
-- CAP TABLE SHAREHOLDERS
-- ============================================

CREATE TABLE IF NOT EXISTS cap_table_shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
    
    -- Shareholder info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    shareholder_type VARCHAR(50) NOT NULL, -- founder, employee, investor, advisor, other
    
    -- Holdings
    common_shares BIGINT NOT NULL DEFAULT 0,
    preferred_shares BIGINT NOT NULL DEFAULT 0,
    options_granted BIGINT NOT NULL DEFAULT 0,
    options_vested BIGINT NOT NULL DEFAULT 0,
    options_exercised BIGINT NOT NULL DEFAULT 0,
    
    -- Vesting (for options/restricted stock)
    vesting_start_date DATE,
    vesting_cliff_months INTEGER DEFAULT 12,
    vesting_total_months INTEGER DEFAULT 48,
    
    -- Investment details (for investors)
    investment_amount DECIMAL(20, 2),
    investment_date DATE,
    share_price DECIMAL(20, 6),
    
    -- Calculated fields (updated on changes)
    total_shares BIGINT GENERATED ALWAYS AS (common_shares + preferred_shares + options_exercised) STORED,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_shareholders_cap_table ON cap_table_shareholders(cap_table_id);
CREATE INDEX idx_cap_shareholders_type ON cap_table_shareholders(shareholder_type);

-- ============================================
-- CAP TABLE FUNDING ROUNDS
-- ============================================

CREATE TABLE IF NOT EXISTS cap_table_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
    
    -- Round info
    name VARCHAR(100) NOT NULL, -- Seed, Series A, etc.
    round_type VARCHAR(50) NOT NULL, -- equity, safe, convertible_note
    status VARCHAR(50) NOT NULL DEFAULT 'planned', -- planned, in_progress, closed
    
    -- Financials
    target_raise DECIMAL(20, 2),
    amount_raised DECIMAL(20, 2) DEFAULT 0,
    pre_money_valuation DECIMAL(20, 2),
    post_money_valuation DECIMAL(20, 2),
    
    -- Share details
    price_per_share DECIMAL(20, 6),
    shares_issued BIGINT DEFAULT 0,
    
    -- SAFE/Convertible specific
    valuation_cap DECIMAL(20, 2),
    discount_rate DECIMAL(5, 2), -- e.g., 20.00 for 20%
    interest_rate DECIMAL(5, 2), -- For convertible notes
    
    -- Dates
    round_date DATE,
    close_date DATE,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_rounds_cap_table ON cap_table_rounds(cap_table_id);
CREATE INDEX idx_cap_rounds_status ON cap_table_rounds(status);

-- ============================================
-- CAP TABLE SCENARIOS (What-if modeling)
-- ============================================

CREATE TABLE IF NOT EXISTS cap_table_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scenario parameters (JSONB for flexibility)
    parameters JSONB NOT NULL DEFAULT '{}',
    -- Structure: {
    --   newRound: { amount, valuation, type },
    --   optionsPoolIncrease: number,
    --   exits: [{ shareholderId, shares, price }]
    -- }
    
    -- Calculated results
    results JSONB DEFAULT '{}',
    -- Structure: {
    --   dilution: { [shareholderId]: { before: %, after: % } },
    --   newOwnership: { [shareholderId]: % },
    --   founderDilution: %,
    --   newInvestorOwnership: %
    -- }
    
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_scenarios_cap_table ON cap_table_scenarios(cap_table_id);
