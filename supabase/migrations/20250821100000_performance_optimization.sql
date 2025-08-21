-- Performance Optimization Migration
-- Task #014: 性能・p95最適化実装
-- Target: 100CCU負荷・99.5%可用性・p95≤1500ms

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- Sales table performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_performance_date_store
ON sales (date DESC, store_id) INCLUDE (revenue_ex_tax, footfall, transactions);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_performance_compound
ON sales (store_id, date DESC, department, product_category) 
WHERE date >= CURRENT_DATE - INTERVAL '2 years';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_revenue_optimization
ON sales (date DESC, revenue_ex_tax DESC) 
WHERE revenue_ex_tax > 0;

-- External data indexes for faster joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_market_date_symbol
ON ext_market_index (date DESC, symbol) INCLUDE (close_price, change_percent);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_weather_date_location
ON ext_weather_daily (date DESC, location) INCLUDE (condition, temperature);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_events_date_type
ON ext_events (date DESC, type) INCLUDE (title, location);

-- Audit log performance index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_performance
ON audit_log (at DESC, actor_id) INCLUDE (action, target);

-- Store and department lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dim_store_lookup
ON dim_store (id) INCLUDE (name, area, lat, lng);

-- ========================================
-- MATERIALIZED VIEWS FOR AGGREGATIONS
-- ========================================

-- Daily sales summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales_summary AS
SELECT 
    date,
    store_id,
    ds.name as store_name,
    ds.area,
    COUNT(*) as record_count,
    SUM(revenue_ex_tax) as total_revenue_ex_tax,
    SUM(footfall) as total_footfall,
    SUM(transactions) as total_transactions,
    SUM(discounts) as total_discounts,
    AVG(revenue_ex_tax) as avg_revenue_ex_tax,
    CASE 
        WHEN SUM(footfall) > 0 THEN SUM(transactions)::numeric / SUM(footfall)
        ELSE 0 
    END as conversion_rate
FROM sales s
JOIN dim_store ds ON s.store_id = ds.id
WHERE date >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY date, store_id, ds.name, ds.area;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales_summary_pk
ON mv_daily_sales_summary (date, store_id);

-- Weekly sales summary for faster trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_sales_summary AS
SELECT 
    DATE_TRUNC('week', date) as week_start,
    store_id,
    ds.name as store_name,
    ds.area,
    SUM(revenue_ex_tax) as total_revenue_ex_tax,
    SUM(footfall) as total_footfall,
    SUM(transactions) as total_transactions,
    AVG(revenue_ex_tax) as avg_revenue_ex_tax,
    CASE 
        WHEN SUM(footfall) > 0 THEN SUM(transactions)::numeric / SUM(footfall)
        ELSE 0 
    END as conversion_rate
FROM sales s
JOIN dim_store ds ON s.store_id = ds.id
WHERE date >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY DATE_TRUNC('week', date), store_id, ds.name, ds.area;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_sales_summary_pk
ON mv_weekly_sales_summary (week_start, store_id);

-- ========================================
-- OPTIMIZED FUNCTIONS
-- ========================================

-- High-performance analytics data function
CREATE OR REPLACE FUNCTION get_optimized_analytics_data(
    p_start_date DATE,
    p_end_date DATE,
    p_store_ids INTEGER[] DEFAULT NULL,
    p_departments TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    sales_data JSONB,
    market_data JSONB,
    weather_data JSONB,
    events_data JSONB,
    summary_stats JSONB
) 
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    v_query_start TIMESTAMP := clock_timestamp();
    v_sales_count INTEGER;
    v_market_count INTEGER;
    v_weather_count INTEGER;
    v_events_count INTEGER;
BEGIN
    -- Log performance start
    RAISE NOTICE 'Starting optimized analytics query for % to %', p_start_date, p_end_date;
    
    -- Return optimized aggregated data
    RETURN QUERY
    WITH sales_agg AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'store_id', store_id,
                'store_name', store_name,
                'area', area,
                'total_revenue_ex_tax', total_revenue_ex_tax,
                'total_footfall', total_footfall,
                'total_transactions', total_transactions,
                'conversion_rate', conversion_rate
            )
        ) as data,
        COUNT(*) as count
        FROM mv_daily_sales_summary
        WHERE date BETWEEN p_start_date AND p_end_date
        AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids))
    ),
    market_agg AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'symbol', symbol,
                'close_price', close_price,
                'change_percent', change_percent
            )
        ) as data,
        COUNT(*) as count
        FROM ext_market_index
        WHERE date BETWEEN p_start_date AND p_end_date
        AND symbol IN ('TOPIX', 'NIKKEI225')
    ),
    weather_agg AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'location', location,
                'condition', condition,
                'temperature', temperature,
                'humidity', humidity,
                'precipitation', precipitation
            )
        ) as data,
        COUNT(*) as count
        FROM ext_weather_daily
        WHERE date BETWEEN p_start_date AND p_end_date
        AND location IN ('東京', '大阪')
    ),
    events_agg AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'title', title,
                'type', type,
                'location', location,
                'impact_radius', impact_radius
            )
        ) as data,
        COUNT(*) as count
        FROM ext_events
        WHERE date BETWEEN p_start_date AND p_end_date
        ORDER BY date DESC
        LIMIT 100
    )
    SELECT 
        COALESCE(s.data, '[]'::jsonb),
        COALESCE(m.data, '[]'::jsonb),
        COALESCE(w.data, '[]'::jsonb),
        COALESCE(e.data, '[]'::jsonb),
        jsonb_build_object(
            'query_duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_query_start),
            'record_counts', jsonb_build_object(
                'sales', COALESCE(s.count, 0),
                'market', COALESCE(m.count, 0),
                'weather', COALESCE(w.count, 0),
                'events', COALESCE(e.count, 0)
            ),
            'date_range', jsonb_build_object(
                'start', p_start_date,
                'end', p_end_date
            )
        )
    FROM sales_agg s
    CROSS JOIN market_agg m
    CROSS JOIN weather_agg w
    CROSS JOIN events_agg e;
    
    -- Log performance completion
    RAISE NOTICE 'Optimized analytics query completed in %ms', 
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_query_start);
END;
$$;

-- Store performance comparison function
CREATE OR REPLACE FUNCTION get_store_performance_ranking(
    p_start_date DATE,
    p_end_date DATE,
    p_metric TEXT DEFAULT 'revenue'
)
RETURNS TABLE (
    store_id INTEGER,
    store_name TEXT,
    area TEXT,
    metric_value NUMERIC,
    rank_position INTEGER,
    percentile NUMERIC
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    WITH store_metrics AS (
        SELECT 
            s.store_id,
            ds.name as store_name,
            ds.area,
            CASE 
                WHEN p_metric = 'revenue' THEN SUM(s.total_revenue_ex_tax)
                WHEN p_metric = 'footfall' THEN SUM(s.total_footfall)
                WHEN p_metric = 'conversion' THEN AVG(s.conversion_rate)
                ELSE SUM(s.total_revenue_ex_tax)
            END as metric_value
        FROM mv_daily_sales_summary s
        JOIN dim_store ds ON s.store_id = ds.id
        WHERE s.date BETWEEN p_start_date AND p_end_date
        GROUP BY s.store_id, ds.name, ds.area
    )
    SELECT 
        sm.store_id,
        sm.store_name,
        sm.area,
        sm.metric_value,
        ROW_NUMBER() OVER (ORDER BY sm.metric_value DESC) as rank_position,
        PERCENT_RANK() OVER (ORDER BY sm.metric_value) as percentile
    FROM store_metrics sm
    ORDER BY sm.metric_value DESC;
$$;

-- ========================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- ========================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP := clock_timestamp();
BEGIN
    RAISE NOTICE 'Starting materialized view refresh at %', v_start_time;
    
    -- Refresh daily summary (this might take a few seconds)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_summary;
    RAISE NOTICE 'Daily summary refreshed in %ms', 
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
    
    -- Refresh weekly summary
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_sales_summary;
    RAISE NOTICE 'Weekly summary refreshed in %ms', 
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
    
    RAISE NOTICE 'All materialized views refreshed in %ms', 
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
END;
$$;

-- ========================================
-- PERFORMANCE MONITORING
-- ========================================

-- Table to track query performance
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_name TEXT NOT NULL,
    execution_time_ms NUMERIC NOT NULL,
    rows_returned INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parameters JSONB
);

-- Index for performance log queries
CREATE INDEX IF NOT EXISTS idx_query_performance_log_time
ON query_performance_log (executed_at DESC, query_name);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
    p_query_name TEXT,
    p_execution_time_ms NUMERIC,
    p_rows_returned INTEGER DEFAULT NULL,
    p_parameters JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO query_performance_log (query_name, execution_time_ms, rows_returned, parameters)
    VALUES (p_query_name, p_execution_time_ms, p_rows_returned, p_parameters);
$$;

-- View for performance monitoring
CREATE OR REPLACE VIEW v_query_performance_summary AS
SELECT 
    query_name,
    COUNT(*) as execution_count,
    ROUND(AVG(execution_time_ms), 2) as avg_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 2) as p95_time_ms,
    ROUND(MAX(execution_time_ms), 2) as max_time_ms,
    ROUND(AVG(rows_returned), 0) as avg_rows_returned,
    DATE_TRUNC('hour', MAX(executed_at)) as last_execution
FROM query_performance_log
WHERE executed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY query_name
ORDER BY p95_time_ms DESC;

-- ========================================
-- AUTOMATIC OPTIMIZATION JOBS
-- ========================================

-- Function to automatically refresh materialized views every 5 minutes
-- This would typically be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION auto_refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only refresh if the last refresh was more than 5 minutes ago
    IF NOT EXISTS (
        SELECT 1 FROM pg_stat_user_tables 
        WHERE schemaname = 'public' 
        AND relname = 'mv_daily_sales_summary'
        AND last_vacuum > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    ) THEN
        PERFORM refresh_performance_views();
    END IF;
END;
$$;

-- ========================================
-- CLEANUP AND MAINTENANCE
-- ========================================

-- Function to clean up old performance logs
CREATE OR REPLACE FUNCTION cleanup_performance_logs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM query_performance_log 
    WHERE executed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old performance log entries', v_deleted_count;
    RETURN v_deleted_count;
END;
$$;

-- ========================================
-- STATISTICS AND ANALYSIS
-- ========================================

-- Update table statistics for better query planning
ANALYZE sales;
ANALYZE ext_market_index;
ANALYZE ext_weather_daily;
ANALYZE ext_events;
ANALYZE audit_log;

-- Set work_mem for better sort performance (session-level)
-- This should be done in application connection settings
-- SET work_mem = '256MB';

-- Enable parallel query execution
-- SET max_parallel_workers_per_gather = 4;

-- ========================================
-- INITIAL DATA REFRESH
-- ========================================

-- Initial refresh of materialized views
SELECT refresh_performance_views();

-- Log the completion
SELECT log_query_performance(
    'initial_performance_migration',
    EXTRACT(MILLISECONDS FROM CURRENT_TIMESTAMP - CURRENT_TIMESTAMP),
    NULL,
    jsonb_build_object('migration', 'performance_optimization_complete')
);

-- Grant necessary permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Performance analysis query for verification
SELECT 
    'Performance optimization migration completed' as status,
    COUNT(*) as materialized_view_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'mv_%';
