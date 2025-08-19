-- Initial schema for business strategy dashboard
-- Migration: 001_initial_schema
-- Date: 2025-08-19

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================
-- Master Tables (Dimension Tables)
-- ===================================

-- Store master table
CREATE TABLE dim_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    area VARCHAR(50),
    phone VARCHAR(20),
    manager_name VARCHAR(100),
    opening_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Department master table
CREATE TABLE dim_department (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product category master table
CREATE TABLE dim_product_category (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES dim_department(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- Core Business Tables
-- ===================================

-- Sales data table (tax-excluded management)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES dim_store(id),
    department_id UUID REFERENCES dim_department(id),
    product_category_id UUID REFERENCES dim_product_category(id),
    revenue_ex_tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    footfall INTEGER DEFAULT 0,
    transactions INTEGER DEFAULT 0,
    discounts DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(date, store_id, department_id, product_category_id),
    CHECK (revenue_ex_tax >= 0),
    CHECK (tax_amount >= 0),
    CHECK (footfall >= 0),
    CHECK (transactions >= 0)
);

-- ===================================
-- External Data Tables
-- ===================================

-- Market index data (TOPIX, Nikkei 225, etc.)
CREATE TABLE ext_market_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    index_code VARCHAR(20) NOT NULL,
    index_name VARCHAR(100),
    value DECIMAL(12, 4),
    change_value DECIMAL(12, 4),
    change_percent DECIMAL(8, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, index_code)
);

-- Stock price data
CREATE TABLE ext_stock_price (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(100),
    open_price DECIMAL(12, 2),
    high_price DECIMAL(12, 2),
    low_price DECIMAL(12, 2),
    close_price DECIMAL(12, 2),
    volume BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, symbol)
);

-- Foreign exchange rates
CREATE TABLE ext_fx_rate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    base_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(12, 6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, base_currency, target_currency)
);

-- Weather data
CREATE TABLE ext_weather_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    temperature_max DECIMAL(5, 2),
    temperature_min DECIMAL(5, 2),
    temperature_avg DECIMAL(5, 2),
    humidity_avg DECIMAL(5, 2),
    precipitation DECIMAL(6, 2),
    weather_condition VARCHAR(50),
    weather_code VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, location)
);

-- Local events data
CREATE TABLE ext_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    end_date DATE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    category VARCHAR(50),
    attendance_estimate INTEGER,
    is_major_event BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inbound tourism statistics
CREATE TABLE ext_inbound (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_month DATE NOT NULL, -- First day of the month
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100),
    visitors INTEGER,
    spending_amount DECIMAL(15, 2),
    avg_stay_days DECIMAL(4, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(year_month, region, country)
);

-- STEM news data
CREATE TABLE ext_stem_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    published_date DATE NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    url TEXT,
    source VARCHAR(100),
    category VARCHAR(50), -- AI, Semiconductor, Robotics, Biotech
    sentiment VARCHAR(20), -- positive, negative, neutral
    keywords TEXT[], -- Array of keywords
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- Audit and System Tables
-- ===================================

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL, -- login, view, export, input, delete
    target_type VARCHAR(100), -- table name or resource type
    target_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB, -- Additional context data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- Indexes for Performance
-- ===================================

-- Sales table indexes
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_store_date ON sales(store_id, date);
CREATE INDEX idx_sales_department_date ON sales(department_id, date);

-- External data indexes
CREATE INDEX idx_ext_market_index_date ON ext_market_index(date);
CREATE INDEX idx_ext_stock_price_date_symbol ON ext_stock_price(date, symbol);
CREATE INDEX idx_ext_fx_rate_date ON ext_fx_rate(date);
CREATE INDEX idx_ext_weather_date_location ON ext_weather_daily(date, location);
CREATE INDEX idx_ext_events_date ON ext_events(date);
CREATE INDEX idx_ext_inbound_year_month ON ext_inbound(year_month);
CREATE INDEX idx_ext_stem_news_date ON ext_stem_news(published_date);

-- Audit log indexes
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ===================================
-- Triggers for updated_at
-- ===================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_dim_store_updated_at 
    BEFORE UPDATE ON dim_store 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_department_updated_at 
    BEFORE UPDATE ON dim_department 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_product_category_updated_at 
    BEFORE UPDATE ON dim_product_category 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON sales 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- Row Level Security Preparation
-- ===================================

-- Enable RLS on sensitive tables (will be configured in later migration)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (initially permissive for all authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON sales
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON audit_log
    FOR ALL USING (auth.role() = 'authenticated');

-- ===================================
-- Comments
-- ===================================

COMMENT ON TABLE sales IS 'Sales data managed in tax-excluded amounts';
COMMENT ON TABLE dim_store IS 'Store master data';
COMMENT ON TABLE dim_department IS 'Department master data';
COMMENT ON TABLE dim_product_category IS 'Product category master data';
COMMENT ON TABLE audit_log IS 'Audit trail for all user actions';

COMMENT ON COLUMN sales.revenue_ex_tax IS 'Revenue amount excluding tax';
COMMENT ON COLUMN sales.tax_amount IS 'Tax amount';
COMMENT ON COLUMN sales.footfall IS 'Number of customers who visited';
COMMENT ON COLUMN sales.transactions IS 'Number of transactions';
