-- Initial schema for Business Strategy Dashboard
-- Task #003: Supabase初期化
-- Created: 2025-08-19

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create custom types
DO $$ 
BEGIN
    -- No custom types needed initially
END $$;

-- ========================================
-- DIMENSION/MASTER TABLES
-- ========================================

-- Store master table
CREATE TABLE IF NOT EXISTS dim_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    area TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Department master table
CREATE TABLE IF NOT EXISTS dim_department (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- SALES DATA TABLES
-- ========================================

-- Sales fact table (tax-exclusive management as per PRD)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES dim_store(id),
    department TEXT, -- FK to dim_department later if needed
    product_category TEXT,
    revenue_ex_tax DECIMAL(15,2) NOT NULL, -- Tax-exclusive as per requirements
    footfall INTEGER,
    transactions INTEGER,
    discounts DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by UUID, -- Will reference auth.users after auth setup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT sales_revenue_positive CHECK (revenue_ex_tax >= 0),
    CONSTRAINT sales_footfall_positive CHECK (footfall IS NULL OR footfall >= 0),
    CONSTRAINT sales_transactions_positive CHECK (transactions IS NULL OR transactions >= 0),
    CONSTRAINT sales_unique_store_date UNIQUE (store_id, date, department, product_category)
);

-- ========================================
-- EXTERNAL DATA TABLES
-- ========================================

-- Market indices (TOPIX, Nikkei, etc.)
CREATE TABLE IF NOT EXISTS ext_market_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    symbol TEXT NOT NULL, -- 'TOPIX', 'NIKKEI225', '7203', '6758', '9984', etc.
    value DECIMAL(15,4) NOT NULL,
    change_percent DECIMAL(8,4),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT ext_market_index_unique UNIQUE (date, symbol)
);

-- Foreign exchange rates
CREATE TABLE IF NOT EXISTS ext_fx_rate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    pair TEXT NOT NULL, -- 'USD/JPY', 'EUR/JPY', 'CNY/JPY'
    rate DECIMAL(10,6) NOT NULL,
    change_percent DECIMAL(8,4),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT ext_fx_rate_unique UNIQUE (date, pair)
);

-- Daily weather data
CREATE TABLE IF NOT EXISTS ext_weather_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    location TEXT NOT NULL, -- City/Prefecture
    temperature_max DECIMAL(5,2),
    temperature_min DECIMAL(5,2),
    precipitation_mm DECIMAL(8,2) DEFAULT 0,
    humidity_percent DECIMAL(5,2),
    weather_condition TEXT, -- 'sunny', 'cloudy', 'rainy', 'snowy', etc.
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT ext_weather_daily_unique UNIQUE (date, location)
);

-- Local events (within 5km radius as per Should requirements)
CREATE TABLE IF NOT EXISTS ext_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    event_type TEXT, -- 'festival', 'concert', 'sports', 'conference', etc.
    expected_attendance INTEGER,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inbound tourism statistics (monthly as per Should requirements)
CREATE TABLE IF NOT EXISTS ext_inbound (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_month TEXT NOT NULL, -- 'YYYY-MM' format
    country TEXT NOT NULL,
    visitors INTEGER NOT NULL,
    change_percent DECIMAL(8,4),
    prefecture TEXT, -- National or prefecture-level data
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT ext_inbound_unique UNIQUE (year_month, country, prefecture)
);

-- STEM news articles
CREATE TABLE IF NOT EXISTS ext_stem_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    published_date DATE NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL, -- 'AI', 'semiconductor', 'robotics', 'biotech'
    url TEXT,
    summary TEXT,
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0 for future sentiment analysis
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- AUDIT/LOGGING TABLES
-- ========================================

-- Audit log for compliance and monitoring
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID, -- References auth.users when available
    action TEXT NOT NULL, -- 'login', 'view_dashboard', 'export_csv', 'input_sales', etc.
    target TEXT, -- Target resource/table affected
    at TIMESTAMPTZ DEFAULT NOW(),
    ip INET,
    ua TEXT, -- User agent
    meta JSONB, -- Additional metadata
    
    -- Indexes for performance
    -- Will be added after table creation
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Sales table indexes
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- External data indexes
CREATE INDEX IF NOT EXISTS idx_ext_market_index_date ON ext_market_index(date);
CREATE INDEX IF NOT EXISTS idx_ext_market_index_symbol ON ext_market_index(symbol);
CREATE INDEX IF NOT EXISTS idx_ext_fx_rate_date ON ext_fx_rate(date);
CREATE INDEX IF NOT EXISTS idx_ext_weather_daily_date ON ext_weather_daily(date);
CREATE INDEX IF NOT EXISTS idx_ext_events_date ON ext_events(date);
CREATE INDEX IF NOT EXISTS idx_ext_inbound_year_month ON ext_inbound(year_month);
CREATE INDEX IF NOT EXISTS idx_ext_stem_news_date ON ext_stem_news(published_date);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_dim_store_updated_at BEFORE UPDATE ON dim_store FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dim_department_updated_at BEFORE UPDATE ON dim_department FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE sales IS 'Sales fact table storing tax-exclusive revenue and related metrics';
COMMENT ON COLUMN sales.revenue_ex_tax IS 'Revenue excluding tax, as per business requirements';
COMMENT ON COLUMN sales.created_by IS 'User who created this record, references auth.users';

COMMENT ON TABLE dim_store IS 'Store dimension table with location information';
COMMENT ON TABLE dim_department IS 'Department/division master table';

COMMENT ON TABLE ext_market_index IS 'External market indices (TOPIX, Nikkei, individual stocks)';
COMMENT ON TABLE ext_fx_rate IS 'Foreign exchange rates (USD/JPY, EUR/JPY, CNY/JPY)';
COMMENT ON TABLE ext_weather_daily IS 'Daily weather data for correlation analysis';
COMMENT ON TABLE ext_events IS 'Local events within 5km radius for impact analysis';
COMMENT ON TABLE ext_inbound IS 'Monthly inbound tourism statistics';
COMMENT ON TABLE ext_stem_news IS 'STEM-related news for strategic insights';

COMMENT ON TABLE audit_log IS 'Audit trail for compliance and security monitoring';
