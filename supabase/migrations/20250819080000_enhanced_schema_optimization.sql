-- Enhanced schema optimization for Business Strategy Dashboard
-- Task #004: データベーススキーマ作成 - 詳細最適化
-- Created: 2025-08-19

-- ========================================
-- ENHANCED CONSTRAINTS AND VALIDATIONS
-- ========================================

-- Add additional constraints to sales table for data quality
ALTER TABLE sales 
ADD CONSTRAINT sales_date_not_future CHECK (date <= CURRENT_DATE),
ADD CONSTRAINT sales_footfall_transactions_consistency 
    CHECK (footfall IS NULL OR transactions IS NULL OR footfall >= transactions),
ADD CONSTRAINT sales_discounts_not_exceed_revenue 
    CHECK (discounts <= revenue_ex_tax),
ADD CONSTRAINT sales_reasonable_revenue_range 
    CHECK (revenue_ex_tax >= 0 AND revenue_ex_tax <= 10000000);

-- Add additional validation to dim_store
ALTER TABLE dim_store
ADD CONSTRAINT dim_store_name_not_empty CHECK (length(trim(name)) > 0),
ADD CONSTRAINT dim_store_lat_range CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
ADD CONSTRAINT dim_store_lng_range CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

-- Add validation to external data tables
ALTER TABLE ext_market_index
ADD CONSTRAINT ext_market_index_value_positive CHECK (value > 0),
ADD CONSTRAINT ext_market_index_change_reasonable CHECK (change_percent >= -100 AND change_percent <= 1000);

ALTER TABLE ext_fx_rate
ADD CONSTRAINT ext_fx_rate_positive CHECK (rate > 0),
ADD CONSTRAINT ext_fx_rate_reasonable_range CHECK (rate > 0.0001 AND rate < 10000);

ALTER TABLE ext_weather_daily
ADD CONSTRAINT ext_weather_temp_logical CHECK (temperature_max IS NULL OR temperature_min IS NULL OR temperature_max >= temperature_min),
ADD CONSTRAINT ext_weather_precipitation_positive CHECK (precipitation_mm >= 0),
ADD CONSTRAINT ext_weather_humidity_range CHECK (humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100));

-- ========================================
-- PERFORMANCE OPTIMIZATION INDEXES  
-- ========================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_store_date_department ON sales(store_id, date, department);
CREATE INDEX IF NOT EXISTS idx_sales_date_revenue ON sales(date, revenue_ex_tax);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_store ON sales(created_at, store_id);

-- External data composite indexes for correlation analysis
CREATE INDEX IF NOT EXISTS idx_ext_market_date_symbol ON ext_market_index(date, symbol);
CREATE INDEX IF NOT EXISTS idx_ext_fx_date_pair ON ext_fx_rate(date, pair);
CREATE INDEX IF NOT EXISTS idx_ext_weather_date_location ON ext_weather_daily(date, location);

-- Event proximity search optimization (for within 5km analysis)
CREATE INDEX IF NOT EXISTS idx_ext_events_date_location ON ext_events(date, lat, lng);

-- Time-based analysis indexes
CREATE INDEX IF NOT EXISTS idx_sales_date_desc ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_ext_market_index_date_desc ON ext_market_index(date DESC);

-- Text search optimization for events and news
CREATE INDEX IF NOT EXISTS idx_ext_events_title_gin ON ext_events USING gin(to_tsvector('japanese', title));
CREATE INDEX IF NOT EXISTS idx_ext_stem_news_title_gin ON ext_stem_news USING gin(to_tsvector('japanese', title));
CREATE INDEX IF NOT EXISTS idx_ext_stem_news_summary_gin ON ext_stem_news USING gin(to_tsvector('japanese', summary));

-- ========================================
-- ROW LEVEL SECURITY PREPARATION
-- ========================================

-- Enable RLS on critical tables (will be activated in Phase 1)
-- Currently commented out as Phase 0 allows full access

-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dim_store ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create roles for future RBAC implementation
DO $$
BEGIN
    -- Create roles if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_admin') THEN
        CREATE ROLE dashboard_admin;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'store_manager') THEN
        CREATE ROLE store_manager;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewer') THEN
        CREATE ROLE viewer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analyst') THEN
        CREATE ROLE analyst;
    END IF;
END $$;

-- Grant permissions for future use (Phase 1)
-- Currently all users have full access via Supabase Auth

-- Prepare RLS policies (commented out for Phase 0)
/*
-- Store access policy - users can only access their assigned stores
CREATE POLICY sales_store_access ON sales
    FOR ALL
    TO authenticated
    USING (
        store_id IN (
            SELECT store_id FROM user_store_access 
            WHERE user_id = auth.uid()
        )
    );

-- Admin access policy - admins can access everything  
CREATE POLICY sales_admin_access ON sales
    FOR ALL
    TO dashboard_admin
    USING (true);

-- Audit log policy - users can only see their own actions
CREATE POLICY audit_log_user_access ON audit_log
    FOR SELECT
    TO authenticated
    USING (actor_id = auth.uid());
*/

-- ========================================
-- ADDITIONAL HELPER FUNCTIONS
-- ========================================

-- Function to calculate distance between two coordinates (for event proximity)
CREATE OR REPLACE FUNCTION calculate_distance(lat1 DECIMAL, lng1 DECIMAL, lat2 DECIMAL, lng2 DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    r DECIMAL := 6371; -- Earth's radius in kilometers
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get events within 5km of a store
CREATE OR REPLACE FUNCTION get_nearby_events(store_lat DECIMAL, store_lng DECIMAL, event_date DATE, radius_km DECIMAL DEFAULT 5)
RETURNS TABLE(
    event_id UUID,
    title TEXT,
    event_type TEXT,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.event_type,
        calculate_distance(store_lat, store_lng, e.lat, e.lng) as distance_km
    FROM ext_events e
    WHERE e.date = event_date
        AND e.lat IS NOT NULL 
        AND e.lng IS NOT NULL
        AND calculate_distance(store_lat, store_lng, e.lat, e.lng) <= radius_km
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ENHANCED FOREIGN KEY RELATIONSHIPS
-- ========================================

-- Add FK constraint for sales.department to dim_department
-- First ensure all existing department values exist in dim_department
INSERT INTO dim_department (name) 
SELECT DISTINCT department 
FROM sales 
WHERE department IS NOT NULL 
    AND department NOT IN (SELECT name FROM dim_department)
ON CONFLICT (name) DO NOTHING;

-- Now add the foreign key constraint
-- Note: This is optional and may be added later for referential integrity
-- ALTER TABLE sales ADD CONSTRAINT fk_sales_department 
--     FOREIGN KEY (department) REFERENCES dim_department(name);

-- ========================================
-- PERFORMANCE MONITORING VIEWS
-- ========================================

-- View for monitoring table sizes and index usage
CREATE OR REPLACE VIEW v_table_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- View for monitoring slow queries (for future optimization)
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_time DESC;

-- ========================================
-- DATA VALIDATION FUNCTIONS
-- ========================================

-- Function to validate sales data before insertion
CREATE OR REPLACE FUNCTION validate_sales_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Log validation in audit_log
    INSERT INTO audit_log (action, target, meta)
    VALUES (
        'validate_sales', 
        'sales',
        jsonb_build_object(
            'store_id', NEW.store_id,
            'date', NEW.date,
            'revenue_ex_tax', NEW.revenue_ex_tax
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sales validation (currently just logging)
DROP TRIGGER IF EXISTS trigger_validate_sales ON sales;
CREATE TRIGGER trigger_validate_sales
    BEFORE INSERT OR UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION validate_sales_data();

-- ========================================
-- COMMENTS AND DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION calculate_distance IS 'Calculate distance between two coordinates using Haversine formula';
COMMENT ON FUNCTION get_nearby_events IS 'Get all events within specified radius of a store location';
COMMENT ON VIEW v_table_stats IS 'Monitor table statistics for query optimization';
COMMENT ON VIEW v_slow_queries IS 'Identify slow queries for performance optimization';

-- Add detailed comments for new constraints
COMMENT ON CONSTRAINT sales_date_not_future ON sales IS 'Prevent future-dated sales entries';
COMMENT ON CONSTRAINT sales_footfall_transactions_consistency ON sales IS 'Ensure footfall >= transactions when both are provided';
COMMENT ON CONSTRAINT sales_reasonable_revenue_range ON sales IS 'Prevent extremely large revenue values that might be data entry errors';
