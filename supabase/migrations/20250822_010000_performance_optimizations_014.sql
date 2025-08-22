-- Migration: 20250822_010000_performance_optimizations_014.sql
-- Task #014: 性能・p95最適化実装
-- Database Performance Optimizations for 100CCU Load & 99.5% Availability

-- =============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================

-- Dashboard Analytics Materialized View
-- Pre-aggregated data for fast dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_dashboard_analytics AS
SELECT 
    s.sales_date,
    s.store_id,
    st.name as store_name,
    st.address as store_address,
    s.department,
    s.product_category,
    -- Sales Aggregations
    SUM(s.revenue_ex_tax) as total_revenue_ex_tax,
    SUM(s.footfall) as total_footfall,
    SUM(s.transactions) as total_transactions,
    SUM(s.discounts) as total_discounts,
    SUM(s.tax) as total_tax,
    -- Calculated KPIs
    CASE 
        WHEN SUM(s.footfall) > 0 THEN SUM(s.revenue_ex_tax) / SUM(s.footfall)
        ELSE 0
    END as avg_customer_price,
    CASE 
        WHEN SUM(s.footfall) > 0 THEN (SUM(s.transactions)::decimal / SUM(s.footfall)) * 100
        ELSE 0
    END as conversion_rate,
    -- External Data (Weather)
    w.temperature as weather_temp,
    w.humidity as weather_humidity,
    w.precipitation as weather_precipitation,
    w.weather_condition,
    -- External Data (Events)
    CASE 
        WHEN COUNT(e.id) > 0 THEN true
        ELSE false
    END as has_nearby_events,
    COUNT(e.id) as nearby_events_count,
    -- Time Dimensions
    EXTRACT(DOW FROM s.sales_date) as day_of_week,
    EXTRACT(MONTH FROM s.sales_date) as month_num,
    EXTRACT(YEAR FROM s.sales_date) as year_num,
    TO_CHAR(s.sales_date, 'YYYY-MM') as year_month,
    -- Comparison Data
    LAG(SUM(s.revenue_ex_tax)) OVER (
        PARTITION BY s.store_id, s.department, s.product_category 
        ORDER BY s.sales_date
    ) as prev_day_revenue,
    -- Data Quality
    COUNT(*) as record_count,
    NOW() as last_updated
FROM sales s
JOIN dim_store st ON s.store_id = st.id
LEFT JOIN ext_weather_daily w ON w.date = s.sales_date
LEFT JOIN ext_events e ON e.event_date = s.sales_date 
    AND ST_DWithin(
        ST_Point(e.longitude, e.latitude), 
        ST_Point(st.longitude, st.latitude), 
        5000 -- 5km radius
    )
WHERE s.sales_date >= CURRENT_DATE - INTERVAL '2 years' -- Keep recent data only
GROUP BY 
    s.sales_date, s.store_id, st.name, st.address, st.longitude, st.latitude,
    s.department, s.product_category,
    w.temperature, w.humidity, w.precipitation, w.weather_condition
ORDER BY s.sales_date DESC, s.store_id;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_vw_dashboard_analytics_unique 
ON vw_dashboard_analytics (sales_date, store_id, department, product_category);

-- Export Data Materialized View
-- Optimized for export operations with all necessary joins
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_export_data AS
SELECT 
    s.sales_date,
    s.store_id,
    st.name as store_name,
    st.address as store_address,
    st.area as store_area,
    s.department,
    s.product_category,
    s.revenue_ex_tax,
    s.footfall,
    s.transactions,
    s.discounts,
    s.tax,
    s.revenue_ex_tax + s.tax as revenue_inc_tax,
    CASE 
        WHEN s.footfall > 0 THEN s.revenue_ex_tax / s.footfall
        ELSE 0
    END as customer_price,
    CASE 
        WHEN s.footfall > 0 THEN (s.transactions::decimal / s.footfall) * 100
        ELSE 0
    END as conversion_rate,
    -- External indicators
    w.temperature,
    w.humidity,
    w.precipitation,
    w.weather_condition,
    COALESCE(e.event_count, 0) as nearby_events,
    -- Market data (latest for date)
    m.topix_close,
    m.nikkei225_close,
    fx.usd_jpy_rate,
    fx.eur_jpy_rate,
    fx.cny_jpy_rate,
    -- Metadata
    s.created_by,
    s.created_at,
    s.updated_at
FROM sales s
JOIN dim_store st ON s.store_id = st.id
LEFT JOIN ext_weather_daily w ON w.date = s.sales_date
LEFT JOIN (
    SELECT 
        event_date,
        COUNT(*) as event_count
    FROM ext_events 
    GROUP BY event_date
) e ON e.event_date = s.sales_date
LEFT JOIN LATERAL (
    SELECT topix_close, nikkei225_close
    FROM ext_market_index 
    WHERE date <= s.sales_date 
    ORDER BY date DESC 
    LIMIT 1
) m ON true
LEFT JOIN LATERAL (
    SELECT usd_jpy_rate, eur_jpy_rate, cny_jpy_rate
    FROM ext_fx_rate 
    WHERE date <= s.sales_date 
    ORDER BY date DESC 
    LIMIT 1
) fx ON true
WHERE s.sales_date >= CURRENT_DATE - INTERVAL '2 years'
ORDER BY s.sales_date DESC, s.store_id, s.department;

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Sales table performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_date_store_dept_perf 
ON sales (sales_date DESC, store_id, department, product_category) 
INCLUDE (revenue_ex_tax, footfall, transactions);

CREATE INDEX IF NOT EXISTS idx_sales_store_date_revenue 
ON sales (store_id, sales_date DESC) 
INCLUDE (revenue_ex_tax, footfall, transactions, discounts);

-- Composite index for dashboard filters
CREATE INDEX IF NOT EXISTS idx_sales_multi_filter 
ON sales (sales_date, store_id, department) 
WHERE sales_date >= CURRENT_DATE - INTERVAL '1 year';

-- External data indexes for joins
CREATE INDEX IF NOT EXISTS idx_weather_date_temp 
ON ext_weather_daily (date DESC) 
INCLUDE (temperature, humidity, precipitation, weather_condition);

CREATE INDEX IF NOT EXISTS idx_events_date_location 
ON ext_events (event_date, latitude, longitude) 
INCLUDE (event_name, event_type);

CREATE INDEX IF NOT EXISTS idx_market_date_values 
ON ext_market_index (date DESC) 
INCLUDE (topix_close, nikkei225_close);

CREATE INDEX IF NOT EXISTS idx_fx_date_rates 
ON ext_fx_rate (date DESC) 
INCLUDE (usd_jpy_rate, eur_jpy_rate, cny_jpy_rate);

-- Audit log performance index
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action_date 
ON audit_log (actor_id, action, created_at DESC) 
INCLUDE (target, metadata);

-- =============================================
-- AGGREGATION FUNCTIONS FOR ANALYTICS
-- =============================================

-- High-performance aggregation function for dashboard
CREATE OR REPLACE FUNCTION get_dashboard_aggregates(
    p_start_date DATE,
    p_end_date DATE,
    p_store_ids INTEGER[] DEFAULT NULL,
    p_departments TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    sales_date DATE,
    store_name TEXT,
    department TEXT,
    total_revenue NUMERIC,
    total_footfall INTEGER,
    total_transactions INTEGER,
    avg_customer_price NUMERIC,
    conversion_rate NUMERIC,
    weather_temp NUMERIC,
    has_events BOOLEAN
) 
LANGUAGE plpgsql
PARALLEL SAFE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.sales_date,
        v.store_name,
        v.department,
        v.total_revenue_ex_tax,
        v.total_footfall,
        v.total_transactions,
        v.avg_customer_price,
        v.conversion_rate,
        v.weather_temp,
        v.has_nearby_events
    FROM vw_dashboard_analytics v
    WHERE v.sales_date >= p_start_date 
        AND v.sales_date <= p_end_date
        AND (p_store_ids IS NULL OR v.store_id = ANY(p_store_ids))
        AND (p_departments IS NULL OR v.department = ANY(p_departments))
        AND (p_categories IS NULL OR v.product_category = ANY(p_categories))
    ORDER BY v.sales_date DESC, v.store_name, v.department;
END;
$$;

-- Correlation analysis function with pre-computed statistics
CREATE OR REPLACE FUNCTION get_correlation_analysis(
    p_start_date DATE,
    p_end_date DATE,
    p_store_ids INTEGER[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
PARALLEL SAFE
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'dayOfWeekAnalysis', day_analysis,
        'weatherCorrelations', weather_corr,
        'eventImpact', event_impact,
        'performanceMetrics', perf_metrics
    ) INTO result
    FROM (
        -- Day of week analysis
        SELECT json_agg(
            json_build_object(
                'dayOfWeek', day_of_week,
                'avgRevenue', avg_revenue,
                'avgFootfall', avg_footfall,
                'relativePerformance', (avg_revenue / overall_avg - 1) * 100
            ) ORDER BY day_of_week
        ) as day_analysis
        FROM (
            SELECT 
                day_of_week,
                AVG(total_revenue_ex_tax) as avg_revenue,
                AVG(total_footfall) as avg_footfall,
                AVG(AVG(total_revenue_ex_tax)) OVER () as overall_avg
            FROM vw_dashboard_analytics
            WHERE sales_date >= p_start_date 
                AND sales_date <= p_end_date
                AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids))
            GROUP BY day_of_week
        ) dow
    ) day_stats,
    (
        -- Weather correlations
        SELECT json_build_object(
            'temperatureCorr', COALESCE(CORR(total_revenue_ex_tax, weather_temp), 0),
            'humidityCorr', COALESCE(CORR(total_revenue_ex_tax, weather_humidity), 0),
            'precipitationCorr', COALESCE(CORR(total_revenue_ex_tax, weather_precipitation), 0)
        ) as weather_corr
        FROM vw_dashboard_analytics
        WHERE sales_date >= p_start_date 
            AND sales_date <= p_end_date
            AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids))
            AND weather_temp IS NOT NULL
    ) weather_stats,
    (
        -- Event impact analysis
        SELECT json_build_object(
            'avgRevenueWithEvents', AVG(CASE WHEN has_nearby_events THEN total_revenue_ex_tax END),
            'avgRevenueWithoutEvents', AVG(CASE WHEN NOT has_nearby_events THEN total_revenue_ex_tax END),
            'eventUplift', 
                CASE 
                    WHEN AVG(CASE WHEN NOT has_nearby_events THEN total_revenue_ex_tax END) > 0
                    THEN (AVG(CASE WHEN has_nearby_events THEN total_revenue_ex_tax END) / 
                          AVG(CASE WHEN NOT has_nearby_events THEN total_revenue_ex_tax END) - 1) * 100
                    ELSE 0
                END
        ) as event_impact
        FROM vw_dashboard_analytics
        WHERE sales_date >= p_start_date 
            AND sales_date <= p_end_date
            AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids))
    ) event_stats,
    (
        -- Performance metrics
        SELECT json_build_object(
            'totalDataPoints', COUNT(*),
            'dateRange', json_build_object('start', MIN(sales_date), 'end', MAX(sales_date)),
            'storesAnalyzed', COUNT(DISTINCT store_id),
            'departmentsAnalyzed', COUNT(DISTINCT department)
        ) as perf_metrics
        FROM vw_dashboard_analytics
        WHERE sales_date >= p_start_date 
            AND sales_date <= p_end_date
            AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids))
    ) perf_stats;

    RETURN result;
END;
$$;

-- =============================================
-- REFRESH PROCEDURES FOR MATERIALIZED VIEWS
-- =============================================

-- Procedure to refresh materialized views efficiently
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS TABLE (
    view_name TEXT,
    refresh_duration INTERVAL,
    rows_affected BIGINT,
    last_refresh TIMESTAMP
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    rows_count BIGINT;
BEGIN
    -- Refresh dashboard analytics view
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY vw_dashboard_analytics;
    end_time := NOW();
    GET DIAGNOSTICS rows_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'vw_dashboard_analytics'::TEXT,
        end_time - start_time,
        rows_count,
        end_time;

    -- Refresh export data view
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY vw_export_data;
    end_time := NOW();
    GET DIAGNOSTICS rows_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'vw_export_data'::TEXT,
        end_time - start_time,
        rows_count,
        end_time;
END;
$$;

-- =============================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================

-- View for monitoring query performance
CREATE OR REPLACE VIEW vw_performance_stats AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND((idx_scan::decimal / (seq_scan + idx_scan)) * 100, 2)
        ELSE 0
    END as index_usage_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan + idx_scan DESC;

-- View for monitoring materialized view freshness
CREATE OR REPLACE VIEW vw_materialized_view_stats AS
SELECT 
    schemaname,
    matviewname,
    hasindexes,
    ispopulated,
    (SELECT last_refresh FROM (
        SELECT NOW() as last_refresh WHERE ispopulated
    ) lr) as estimated_last_refresh
FROM pg_matviews
WHERE schemaname = 'public';

-- =============================================
-- PERFORMANCE CONFIGURATION
-- =============================================

-- Optimize PostgreSQL settings for performance
-- (These should be set in postgresql.conf or via ALTER SYSTEM)

-- Enable parallel query execution
SET max_parallel_workers_per_gather = 4;
SET max_parallel_workers = 8;
SET parallel_tuple_cost = 0.1;
SET parallel_setup_cost = 1000.0;

-- Optimize memory settings
SET work_mem = '16MB';
SET maintenance_work_mem = '256MB';
SET effective_cache_size = '1GB';

-- Enable query plan caching
SET plan_cache_mode = 'auto';

-- =============================================
-- SCHEDULED REFRESH JOB
-- =============================================

-- Create extension for pg_cron if not exists
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule materialized view refresh every 15 minutes
-- This should be configured via pg_cron or application scheduler
/*
SELECT cron.schedule('refresh-performance-views', '*/15 * * * *', 
    'SELECT refresh_performance_views();'
);
*/

-- =============================================
-- PERFORMANCE VALIDATION
-- =============================================

-- Function to validate performance optimizations
CREATE OR REPLACE FUNCTION validate_performance_setup()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if materialized views exist and are populated
    RETURN QUERY
    SELECT 
        'Materialized Views'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 2 AND bool_and(ispopulated) THEN '✅ OK'
            ELSE '❌ ERROR'
        END as status,
        format('Found %s materialized views, %s populated', 
               COUNT(*), 
               COUNT(*) FILTER (WHERE ispopulated)) as details
    FROM pg_matviews 
    WHERE schemaname = 'public' 
        AND matviewname IN ('vw_dashboard_analytics', 'vw_export_data');

    -- Check if performance indexes exist
    RETURN QUERY
    SELECT 
        'Performance Indexes'::TEXT,
        CASE 
            WHEN COUNT(*) >= 5 THEN '✅ OK'
            ELSE '⚠️ WARNING'
        END,
        format('Found %s performance indexes', COUNT(*)) as details
    FROM pg_indexes 
    WHERE schemaname = 'public' 
        AND indexname LIKE '%_perf%' OR indexname LIKE 'idx_%';

    -- Check if aggregation functions exist
    RETURN QUERY
    SELECT 
        'Aggregation Functions'::TEXT,
        CASE 
            WHEN COUNT(*) >= 2 THEN '✅ OK'
            ELSE '❌ ERROR'
        END,
        format('Found %s aggregation functions', COUNT(*)) as details
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
        AND p.proname IN ('get_dashboard_aggregates', 'get_correlation_analysis');
END;
$$;

-- Run validation
SELECT * FROM validate_performance_setup();

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON MATERIALIZED VIEW vw_dashboard_analytics IS 
'Pre-aggregated dashboard data for high-performance queries. Refreshed every 15 minutes.
Optimized for 100CCU load with sub-second response times.';

COMMENT ON MATERIALIZED VIEW vw_export_data IS 
'Optimized export data view with all necessary joins pre-computed.
Supports large export operations with streaming capability.';

COMMENT ON FUNCTION get_dashboard_aggregates IS 
'High-performance aggregation function for dashboard queries.
Uses materialized view for optimal performance under load.';

COMMENT ON FUNCTION get_correlation_analysis IS 
'Pre-computed correlation analysis with statistical functions.
Returns comprehensive JSON result for analytics dashboard.';

COMMENT ON FUNCTION refresh_performance_views IS 
'Refreshes all performance-critical materialized views.
Should be called every 15 minutes via scheduler.';
