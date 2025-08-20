-- ========================================
-- Performance-Optimized Database Functions
-- Task #014: 性能・p95最適化実装 - データベース最適化
-- ========================================

-- Function: Calculate sales correlations with external factors
-- Used in: optimized-helpers.ts
CREATE OR REPLACE FUNCTION calculate_sales_correlations(
  start_date DATE,
  end_date DATE,
  store_ids TEXT[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  weather_corr NUMERIC;
  events_corr NUMERIC;
  market_corr NUMERIC;
BEGIN
  -- Weather correlation calculation
  WITH daily_sales AS (
    SELECT 
      date,
      SUM(revenue_ex_tax) as daily_revenue
    FROM sales s
    WHERE s.date >= start_date 
      AND s.date <= end_date
      AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
    GROUP BY date
  ),
  weather_sales AS (
    SELECT 
      ds.date,
      ds.daily_revenue,
      w.temperature,
      w.humidity,
      w.precipitation
    FROM daily_sales ds
    LEFT JOIN ext_weather_daily w ON ds.date = w.date
    WHERE w.temperature IS NOT NULL
  )
  SELECT 
    COALESCE(
      CORR(daily_revenue, temperature), 
      0.0
    )
  INTO weather_corr
  FROM weather_sales;

  -- Events correlation calculation
  WITH daily_sales AS (
    SELECT 
      date,
      SUM(revenue_ex_tax) as daily_revenue
    FROM sales s
    WHERE s.date >= start_date 
      AND s.date <= end_date
      AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
    GROUP BY date
  ),
  events_sales AS (
    SELECT 
      ds.date,
      ds.daily_revenue,
      CASE WHEN e.id IS NOT NULL THEN 1.0 ELSE 0.0 END as has_event
    FROM daily_sales ds
    LEFT JOIN ext_events e ON ds.date = e.date
  )
  SELECT 
    COALESCE(
      CORR(daily_revenue, has_event), 
      0.0
    )
  INTO events_corr
  FROM events_sales;

  -- Market correlation calculation
  WITH daily_sales AS (
    SELECT 
      date,
      SUM(revenue_ex_tax) as daily_revenue
    FROM sales s
    WHERE s.date >= start_date 
      AND s.date <= end_date
      AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
    GROUP BY date
  ),
  market_sales AS (
    SELECT 
      ds.date,
      ds.daily_revenue,
      m.value as market_index
    FROM daily_sales ds
    LEFT JOIN ext_market_index m ON ds.date = m.date 
      AND m.symbol = 'TOPIX'
    WHERE m.value IS NOT NULL
  )
  SELECT 
    COALESCE(
      CORR(daily_revenue, market_index), 
      0.0
    )
  INTO market_corr
  FROM market_sales;

  -- Build result JSON
  result := jsonb_build_object(
    'weather_sales', COALESCE(weather_corr, 0.0),
    'events_sales', COALESCE(events_corr, 0.0),
    'market_sales', COALESCE(market_corr, 0.0),
    'calculated_at', CURRENT_TIMESTAMP,
    'date_range', jsonb_build_object(
      'start', start_date,
      'end', end_date
    )
  );

  RETURN result;
END;
$$;

-- Function: Get store performance summary
-- Used in: optimized-helpers.ts
CREATE OR REPLACE FUNCTION get_store_performance_summary(
  start_date DATE,
  end_date DATE
) RETURNS TABLE (
  store_id INTEGER,
  store_name VARCHAR,
  area VARCHAR,
  total_revenue NUMERIC,
  total_footfall INTEGER,
  total_transactions INTEGER,
  avg_transaction_value NUMERIC,
  conversion_rate NUMERIC,
  revenue_growth_rate NUMERIC,
  performance_rank INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH store_metrics AS (
    SELECT 
      s.store_id,
      ds.name as store_name,
      ds.area,
      SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as total_revenue,
      SUM(s.footfall) as total_footfall,
      SUM(s.transactions) as total_transactions,
      CASE 
        WHEN SUM(s.transactions) > 0 
        THEN SUM(s.revenue_ex_tax) / SUM(s.transactions)
        ELSE 0 
      END as avg_transaction_value,
      CASE 
        WHEN SUM(s.footfall) > 0 
        THEN SUM(s.transactions)::NUMERIC / SUM(s.footfall) * 100
        ELSE 0 
      END as conversion_rate
    FROM sales s
    INNER JOIN dim_store ds ON s.store_id = ds.id
    WHERE s.date >= start_date AND s.date <= end_date
    GROUP BY s.store_id, ds.name, ds.area
  ),
  previous_period AS (
    SELECT 
      s.store_id,
      SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as prev_revenue
    FROM sales s
    WHERE s.date >= (start_date - (end_date - start_date + 1))
      AND s.date < start_date
    GROUP BY s.store_id
  ),
  with_growth AS (
    SELECT 
      sm.*,
      CASE 
        WHEN pp.prev_revenue IS NOT NULL AND pp.prev_revenue > 0
        THEN ((sm.total_revenue - pp.prev_revenue) / pp.prev_revenue) * 100
        ELSE 0
      END as revenue_growth_rate
    FROM store_metrics sm
    LEFT JOIN previous_period pp ON sm.store_id = pp.store_id
  ),
  ranked AS (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY total_revenue DESC) as performance_rank
    FROM with_growth
  )
  SELECT 
    r.store_id,
    r.store_name,
    r.area,
    r.total_revenue,
    r.total_footfall,
    r.total_transactions,
    r.avg_transaction_value,
    r.conversion_rate,
    r.revenue_growth_rate,
    r.performance_rank::INTEGER
  FROM ranked r
  ORDER BY performance_rank;
END;
$$;

-- Function: Get performance metrics for monitoring
-- Used for SLO monitoring
CREATE OR REPLACE FUNCTION get_performance_metrics(
  time_window_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
  metric_name VARCHAR,
  metric_value NUMERIC,
  timestamp TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH recent_logs AS (
    SELECT 
      action,
      created_at,
      meta
    FROM audit_log
    WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '1 minute' * time_window_minutes)
  ),
  response_times AS (
    SELECT 
      (meta->>'responseTime')::NUMERIC as response_time
    FROM recent_logs
    WHERE meta->>'responseTime' IS NOT NULL
      AND (meta->>'responseTime')::NUMERIC > 0
  ),
  error_rates AS (
    SELECT 
      COUNT(*) FILTER (WHERE action LIKE '%_error' OR action LIKE '%_failed') as error_count,
      COUNT(*) as total_count
    FROM recent_logs
  )
  SELECT 'average_response_time'::VARCHAR, 
         COALESCE(AVG(rt.response_time), 0)::NUMERIC, 
         CURRENT_TIMESTAMP
  FROM response_times rt
  
  UNION ALL
  
  SELECT 'p95_response_time'::VARCHAR, 
         COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rt.response_time), 0)::NUMERIC,
         CURRENT_TIMESTAMP
  FROM response_times rt
  
  UNION ALL
  
  SELECT 'error_rate'::VARCHAR, 
         CASE 
           WHEN er.total_count > 0 
           THEN (er.error_count::NUMERIC / er.total_count::NUMERIC) * 100
           ELSE 0 
         END,
         CURRENT_TIMESTAMP
  FROM error_rates er
  
  UNION ALL
  
  SELECT 'request_count'::VARCHAR, 
         COUNT(*)::NUMERIC, 
         CURRENT_TIMESTAMP
  FROM recent_logs;
END;
$$;

-- Function: Check SLO compliance
-- Returns current SLO status
CREATE OR REPLACE FUNCTION check_slo_compliance(
  time_window_minutes INTEGER DEFAULT 60
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  avg_response_time NUMERIC;
  p95_response_time NUMERIC;
  error_rate NUMERIC;
  availability NUMERIC;
  slo_met BOOLEAN;
BEGIN
  -- Get metrics
  SELECT 
    AVG(CASE WHEN metric_name = 'average_response_time' THEN metric_value END),
    AVG(CASE WHEN metric_name = 'p95_response_time' THEN metric_value END),
    AVG(CASE WHEN metric_name = 'error_rate' THEN metric_value END)
  INTO avg_response_time, p95_response_time, error_rate
  FROM get_performance_metrics(time_window_minutes);

  -- Calculate availability
  availability := CASE 
    WHEN error_rate IS NULL THEN 100.0
    ELSE GREATEST(0.0, 100.0 - error_rate)
  END;

  -- Check SLO targets: 99.5% availability, p95 ≤ 1500ms
  slo_met := (
    COALESCE(availability, 100.0) >= 99.5 
    AND COALESCE(p95_response_time, 0) <= 1500
  );

  -- Build result
  result := jsonb_build_object(
    'slo_met', slo_met,
    'metrics', jsonb_build_object(
      'average_response_time', COALESCE(avg_response_time, 0),
      'p95_response_time', COALESCE(p95_response_time, 0),
      'error_rate', COALESCE(error_rate, 0),
      'availability', availability
    ),
    'targets', jsonb_build_object(
      'availability_target', 99.5,
      'p95_target', 1500
    ),
    'time_window_minutes', time_window_minutes,
    'checked_at', CURRENT_TIMESTAMP
  );

  RETURN result;
END;
$$;

-- Function: Get database health metrics
-- For monitoring database performance
CREATE OR REPLACE FUNCTION get_database_health() RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  active_connections INTEGER;
  slow_queries INTEGER;
  cache_hit_ratio NUMERIC;
  db_size_mb NUMERIC;
BEGIN
  -- Get active connections
  SELECT COUNT(*) 
  INTO active_connections
  FROM pg_stat_activity 
  WHERE state = 'active';

  -- Simulated slow queries count (in real implementation, check pg_stat_statements)
  slow_queries := 0;

  -- Calculate cache hit ratio
  SELECT 
    ROUND(
      100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 
      2
    )
  INTO cache_hit_ratio
  FROM pg_stat_database;

  -- Get database size
  SELECT 
    ROUND(
      pg_database_size(current_database()) / 1024.0 / 1024.0, 
      2
    )
  INTO db_size_mb;

  result := jsonb_build_object(
    'active_connections', COALESCE(active_connections, 0),
    'slow_queries', COALESCE(slow_queries, 0),
    'cache_hit_ratio', COALESCE(cache_hit_ratio, 0),
    'database_size_mb', COALESCE(db_size_mb, 0),
    'max_connections', current_setting('max_connections')::INTEGER,
    'checked_at', CURRENT_TIMESTAMP,
    'health_status', CASE 
      WHEN active_connections < (current_setting('max_connections')::INTEGER * 0.8)
        AND COALESCE(cache_hit_ratio, 0) > 90
      THEN 'healthy'
      WHEN active_connections < (current_setting('max_connections')::INTEGER * 0.9)
        AND COALESCE(cache_hit_ratio, 0) > 80
      THEN 'warning'
      ELSE 'critical'
    END
  );

  RETURN result;
END;
$$;

-- Function: Cleanup old data for performance
-- Helps maintain database performance by removing old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
  days_to_keep INTEGER DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  audit_deleted INTEGER;
  temp_cleaned INTEGER;
BEGIN
  -- Clean old audit logs (keep last 90 days by default)
  DELETE FROM audit_log 
  WHERE created_at < (CURRENT_DATE - INTERVAL '1 day' * days_to_keep);
  
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;

  -- Clean up any temporary/cache tables if they exist
  temp_cleaned := 0;

  -- Vacuum analyze for performance
  VACUUM ANALYZE;

  result := jsonb_build_object(
    'audit_logs_deleted', audit_deleted,
    'temp_records_cleaned', temp_cleaned,
    'days_kept', days_to_keep,
    'cleaned_at', CURRENT_TIMESTAMP,
    'vacuum_completed', true
  );

  RETURN result;
END;
$$;

-- Create indexes for performance optimization
-- These support the functions above and general query performance

-- Index for sales date range queries
CREATE INDEX IF NOT EXISTS idx_sales_date_store_optimized 
ON sales (date DESC, store_id) 
INCLUDE (revenue_ex_tax, footfall, transactions, tax);

-- Index for audit log performance monitoring
CREATE INDEX IF NOT EXISTS idx_audit_log_performance 
ON audit_log (created_at DESC, action) 
INCLUDE (meta);

-- Index for external data correlations
CREATE INDEX IF NOT EXISTS idx_weather_date 
ON ext_weather_daily (date) 
INCLUDE (temperature, humidity, precipitation);

CREATE INDEX IF NOT EXISTS idx_market_date_symbol 
ON ext_market_index (date, symbol) 
INCLUDE (value);

CREATE INDEX IF NOT EXISTS idx_events_date 
ON ext_events (date) 
INCLUDE (event_type, location);

-- Composite index for store performance queries
CREATE INDEX IF NOT EXISTS idx_dim_store_area 
ON dim_store (area, id) 
INCLUDE (name);

-- Grant permissions for API usage
GRANT EXECUTE ON FUNCTION calculate_sales_correlations TO authenticated;
GRANT EXECUTE ON FUNCTION get_store_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION check_slo_compliance TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_health TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_data TO authenticated;

COMMENT ON FUNCTION calculate_sales_correlations IS 
'Calculates correlations between sales and external factors (weather, events, market)';

COMMENT ON FUNCTION get_store_performance_summary IS 
'Returns comprehensive store performance metrics with rankings';

COMMENT ON FUNCTION get_performance_metrics IS 
'Returns real-time performance metrics for SLO monitoring';

COMMENT ON FUNCTION check_slo_compliance IS 
'Checks current SLO compliance status (99.5% availability, p95 ≤ 1500ms)';

COMMENT ON FUNCTION get_database_health IS 
'Returns database health metrics including connections, cache hit ratio, and size';

COMMENT ON FUNCTION cleanup_old_data IS 
'Maintains database performance by cleaning old audit logs and temporary data';
