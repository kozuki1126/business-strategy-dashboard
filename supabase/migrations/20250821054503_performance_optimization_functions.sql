/**
 * Database Performance Optimization Functions
 * Task #014: 性能・p95最適化実装 - データベース最適化関数
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

-- ========================================
-- CORRELATION ANALYSIS FUNCTION
-- ========================================

-- 売上と外部指標の相関分析関数
CREATE OR REPLACE FUNCTION calculate_sales_correlations(
  start_date DATE,
  end_date DATE,
  store_ids INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
  weather_sales NUMERIC(10,6),
  events_sales NUMERIC(10,6),
  market_sales NUMERIC(10,6),
  sample_size INTEGER,
  confidence_level NUMERIC(5,3)
) 
LANGUAGE plpgsql
AS $$
DECLARE
  correlation_threshold NUMERIC := 0.1;
  min_sample_size INTEGER := 30;
  actual_sample_size INTEGER;
BEGIN
  -- 基本売上データの取得と前処理
  DROP TABLE IF EXISTS temp_sales_daily;
  CREATE TEMP TABLE temp_sales_daily AS
  SELECT 
    s.date,
    SUM(s.revenue_ex_tax) as daily_revenue,
    COUNT(*) as transaction_count,
    AVG(CASE WHEN s.footfall > 0 THEN s.footfall ELSE NULL END) as avg_footfall
  FROM sales s
  WHERE s.date BETWEEN start_date AND end_date
    AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
  GROUP BY s.date
  HAVING SUM(s.revenue_ex_tax) > 0;

  -- サンプルサイズの確認
  SELECT COUNT(*) INTO actual_sample_size FROM temp_sales_daily;
  
  IF actual_sample_size < min_sample_size THEN
    -- サンプルサイズが不足の場合はデフォルト値を返す
    RETURN QUERY SELECT 
      0.0::NUMERIC(10,6) as weather_sales,
      0.0::NUMERIC(10,6) as events_sales, 
      0.0::NUMERIC(10,6) as market_sales,
      actual_sample_size as sample_size,
      0.0::NUMERIC(5,3) as confidence_level;
    RETURN;
  END IF;

  -- 天候との相関（気温、湿度、降水量を総合指標化）
  DROP TABLE IF EXISTS temp_weather_correlation;
  CREATE TEMP TABLE temp_weather_correlation AS
  SELECT 
    s.date,
    s.daily_revenue,
    w.temperature_high,
    w.humidity,
    w.precipitation,
    -- 天候快適度指数（0-100）
    CASE 
      WHEN w.temperature_high BETWEEN 18 AND 25 THEN 30
      WHEN w.temperature_high BETWEEN 15 AND 30 THEN 20
      ELSE 10
    END +
    CASE 
      WHEN w.humidity BETWEEN 40 AND 60 THEN 30
      WHEN w.humidity BETWEEN 30 AND 70 THEN 20
      ELSE 10
    END +
    CASE 
      WHEN w.precipitation = 0 THEN 40
      WHEN w.precipitation < 5 THEN 30
      WHEN w.precipitation < 20 THEN 15
      ELSE 0
    END as weather_comfort_index
  FROM temp_sales_daily s
  LEFT JOIN ext_weather_daily w ON s.date = w.date
  WHERE w.date IS NOT NULL;

  -- イベントとの相関（近隣イベント有無の影響）
  DROP TABLE IF EXISTS temp_events_correlation;
  CREATE TEMP TABLE temp_events_correlation AS
  SELECT 
    s.date,
    s.daily_revenue,
    CASE 
      WHEN COUNT(e.id) = 0 THEN 0
      WHEN COUNT(e.id) = 1 THEN 1
      WHEN COUNT(e.id) <= 3 THEN 2
      ELSE 3
    END as event_intensity
  FROM temp_sales_daily s
  LEFT JOIN ext_events e ON s.date = e.date
  GROUP BY s.date, s.daily_revenue;

  -- 市場指標との相関（TOPIX、日経225の変動率）
  DROP TABLE IF EXISTS temp_market_correlation;
  CREATE TEMP TABLE temp_market_correlation AS
  SELECT 
    s.date,
    s.daily_revenue,
    COALESCE(
      (m_current.close_price - m_prev.close_price) / NULLIF(m_prev.close_price, 0) * 100,
      0
    ) as market_change_rate
  FROM temp_sales_daily s
  LEFT JOIN ext_market_index m_current ON s.date = m_current.date 
    AND m_current.symbol = 'TOPIX'
  LEFT JOIN ext_market_index m_prev ON (s.date - INTERVAL '1 day')::date = m_prev.date 
    AND m_prev.symbol = 'TOPIX'
  WHERE m_current.date IS NOT NULL;

  -- Pearson相関係数の計算
  RETURN QUERY
  WITH correlation_stats AS (
    SELECT
      -- 天候相関
      CASE 
        WHEN COUNT(wc.*) >= min_sample_size THEN
          (COUNT(wc.*) * SUM(wc.daily_revenue * wc.weather_comfort_index) - 
           SUM(wc.daily_revenue) * SUM(wc.weather_comfort_index)) /
          NULLIF(
            SQRT(
              (COUNT(wc.*) * SUM(wc.daily_revenue * wc.daily_revenue) - POWER(SUM(wc.daily_revenue), 2)) *
              (COUNT(wc.*) * SUM(wc.weather_comfort_index * wc.weather_comfort_index) - POWER(SUM(wc.weather_comfort_index), 2))
            ),
            0
          )
        ELSE 0
      END as weather_corr,
      
      -- イベント相関
      CASE 
        WHEN COUNT(ec.*) >= min_sample_size THEN
          (COUNT(ec.*) * SUM(ec.daily_revenue * ec.event_intensity) - 
           SUM(ec.daily_revenue) * SUM(ec.event_intensity)) /
          NULLIF(
            SQRT(
              (COUNT(ec.*) * SUM(ec.daily_revenue * ec.daily_revenue) - POWER(SUM(ec.daily_revenue), 2)) *
              (COUNT(ec.*) * SUM(ec.event_intensity * ec.event_intensity) - POWER(SUM(ec.event_intensity), 2))
            ),
            0
          )
        ELSE 0
      END as events_corr,
      
      -- 市場相関
      CASE 
        WHEN COUNT(mc.*) >= min_sample_size THEN
          (COUNT(mc.*) * SUM(mc.daily_revenue * mc.market_change_rate) - 
           SUM(mc.daily_revenue) * SUM(mc.market_change_rate)) /
          NULLIF(
            SQRT(
              (COUNT(mc.*) * SUM(mc.daily_revenue * mc.daily_revenue) - POWER(SUM(mc.daily_revenue), 2)) *
              (COUNT(mc.*) * SUM(mc.market_change_rate * mc.market_change_rate) - POWER(SUM(mc.market_change_rate), 2))
            ),
            0
          )
        ELSE 0
      END as market_corr,
      
      actual_sample_size as sample_count
    FROM temp_weather_correlation wc
    FULL OUTER JOIN temp_events_correlation ec ON wc.date = ec.date
    FULL OUTER JOIN temp_market_correlation mc ON COALESCE(wc.date, ec.date) = mc.date
  )
  SELECT 
    ROUND(COALESCE(cs.weather_corr, 0), 6)::NUMERIC(10,6) as weather_sales,
    ROUND(COALESCE(cs.events_corr, 0), 6)::NUMERIC(10,6) as events_sales,
    ROUND(COALESCE(cs.market_corr, 0), 6)::NUMERIC(10,6) as market_sales,
    cs.sample_count as sample_size,
    CASE 
      WHEN cs.sample_count >= 100 THEN 0.95
      WHEN cs.sample_count >= 50 THEN 0.90
      WHEN cs.sample_count >= 30 THEN 0.80
      ELSE 0.60
    END::NUMERIC(5,3) as confidence_level
  FROM correlation_stats cs;

  -- クリーンアップ
  DROP TABLE IF EXISTS temp_sales_daily;
  DROP TABLE IF EXISTS temp_weather_correlation;
  DROP TABLE IF EXISTS temp_events_correlation;
  DROP TABLE IF EXISTS temp_market_correlation;
END;
$$;

-- ========================================
-- STORE PERFORMANCE ANALYSIS FUNCTION
-- ========================================

-- 店舗パフォーマンス要約関数
CREATE OR REPLACE FUNCTION get_store_performance_summary(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE(
  store_id INTEGER,
  store_name TEXT,
  area TEXT,
  total_revenue NUMERIC(15,2),
  total_transactions INTEGER,
  total_footfall INTEGER,
  avg_transaction_value NUMERIC(10,2),
  conversion_rate NUMERIC(6,4),
  revenue_growth_rate NUMERIC(8,4),
  performance_score INTEGER,
  ranking INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  period_days INTEGER;
BEGIN
  -- 期間の計算
  period_days := end_date - start_date + 1;
  
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      s.store_id,
      ds.name as store_name,
      ds.area,
      SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as total_revenue,
      SUM(s.transactions) as total_transactions,
      SUM(s.footfall) as total_footfall,
      COUNT(DISTINCT s.date) as active_days
    FROM sales s
    JOIN dim_store ds ON s.store_id = ds.id
    WHERE s.date BETWEEN start_date AND end_date
    GROUP BY s.store_id, ds.name, ds.area
  ),
  previous_period AS (
    SELECT 
      s.store_id,
      SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as prev_total_revenue
    FROM sales s
    WHERE s.date BETWEEN (start_date - period_days::INTEGER) AND (start_date - 1)
    GROUP BY s.store_id
  ),
  performance_metrics AS (
    SELECT 
      cp.*,
      COALESCE(pp.prev_total_revenue, 0) as prev_revenue,
      -- 平均客単価
      CASE 
        WHEN cp.total_transactions > 0 THEN cp.total_revenue / cp.total_transactions
        ELSE 0
      END as avg_transaction_value,
      -- 転換率
      CASE 
        WHEN cp.total_footfall > 0 THEN cp.total_transactions::NUMERIC / cp.total_footfall
        ELSE 0
      END as conversion_rate,
      -- 成長率
      CASE 
        WHEN COALESCE(pp.prev_total_revenue, 0) > 0 THEN 
          (cp.total_revenue - COALESCE(pp.prev_total_revenue, 0)) / pp.prev_total_revenue
        ELSE 0
      END as revenue_growth_rate
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.store_id = pp.store_id
  ),
  scored_performance AS (
    SELECT 
      pm.*,
      -- パフォーマンススコア（0-100）
      LEAST(100, GREATEST(0,
        -- 売上貢献度（40点）
        (PERCENT_RANK() OVER (ORDER BY pm.total_revenue) * 40) +
        -- 効率性（30点）
        (PERCENT_RANK() OVER (ORDER BY pm.avg_transaction_value) * 15) +
        (PERCENT_RANK() OVER (ORDER BY pm.conversion_rate) * 15) +
        -- 成長性（30点）
        CASE 
          WHEN pm.revenue_growth_rate > 0.2 THEN 30
          WHEN pm.revenue_growth_rate > 0.1 THEN 25
          WHEN pm.revenue_growth_rate > 0.05 THEN 20
          WHEN pm.revenue_growth_rate > 0 THEN 15
          WHEN pm.revenue_growth_rate > -0.05 THEN 10
          WHEN pm.revenue_growth_rate > -0.1 THEN 5
          ELSE 0
        END
      ))::INTEGER as performance_score
    FROM performance_metrics pm
  )
  SELECT 
    sp.store_id,
    sp.store_name,
    sp.area,
    ROUND(sp.total_revenue, 2) as total_revenue,
    sp.total_transactions,
    sp.total_footfall,
    ROUND(sp.avg_transaction_value, 2) as avg_transaction_value,
    ROUND(sp.conversion_rate, 4) as conversion_rate,
    ROUND(sp.revenue_growth_rate, 4) as revenue_growth_rate,
    sp.performance_score,
    ROW_NUMBER() OVER (ORDER BY sp.performance_score DESC, sp.total_revenue DESC)::INTEGER as ranking
  FROM scored_performance sp
  ORDER BY sp.performance_score DESC, sp.total_revenue DESC;
END;
$$;

-- ========================================
-- OPTIMIZED AGGREGATION VIEWS
-- ========================================

-- 日別売上集計ビュー（パフォーマンス最適化）
CREATE OR REPLACE VIEW v_daily_sales_summary AS
SELECT 
  s.date,
  s.store_id,
  ds.name as store_name,
  ds.area,
  s.department,
  s.product_category,
  SUM(s.revenue_ex_tax) as revenue_ex_tax,
  SUM(s.tax) as tax,
  SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as total_revenue,
  SUM(s.transactions) as transactions,
  SUM(s.footfall) as footfall,
  SUM(s.discounts) as discounts,
  CASE 
    WHEN SUM(s.transactions) > 0 THEN 
      SUM(s.revenue_ex_tax) / SUM(s.transactions)
    ELSE 0
  END as avg_transaction_value,
  CASE 
    WHEN SUM(s.footfall) > 0 THEN 
      SUM(s.transactions)::NUMERIC / SUM(s.footfall)
    ELSE 0
  END as conversion_rate,
  COUNT(*) as record_count,
  MIN(s.created_at) as first_entry,
  MAX(s.updated_at) as last_updated
FROM sales s
JOIN dim_store ds ON s.store_id = ds.id
GROUP BY 
  s.date, s.store_id, ds.name, ds.area, 
  s.department, s.product_category;

-- 月別売上トレンドビュー
CREATE OR REPLACE VIEW v_monthly_sales_trend AS
SELECT 
  DATE_TRUNC('month', s.date) as month,
  s.store_id,
  ds.name as store_name,
  ds.area,
  SUM(s.revenue_ex_tax + COALESCE(s.tax, 0)) as total_revenue,
  SUM(s.transactions) as total_transactions,
  SUM(s.footfall) as total_footfall,
  AVG(CASE 
    WHEN s.transactions > 0 THEN s.revenue_ex_tax / s.transactions 
    ELSE NULL 
  END) as avg_transaction_value,
  AVG(CASE 
    WHEN s.footfall > 0 THEN s.transactions::NUMERIC / s.footfall 
    ELSE NULL 
  END) as avg_conversion_rate,
  COUNT(DISTINCT s.date) as active_days
FROM sales s
JOIN dim_store ds ON s.store_id = ds.id
WHERE s.date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY 
  DATE_TRUNC('month', s.date), s.store_id, ds.name, ds.area
ORDER BY month DESC, total_revenue DESC;

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- 売上データの複合インデックス（クエリ最適化）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_date_store_dept_cat 
ON sales (date, store_id, department, product_category);

-- 外部データの日付インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_weather_date_location 
ON ext_weather_daily (date, location);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_market_date_symbol 
ON ext_market_index (date, symbol);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ext_events_date 
ON ext_events (date);

-- 監査ログの最適化インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_timestamp_action 
ON audit_log (timestamp DESC, action);

-- ========================================
-- STATISTICS UPDATE FUNCTION
-- ========================================

-- 統計情報更新関数（パフォーマンス維持）
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 主要テーブルの統計情報を更新
  ANALYZE sales;
  ANALYZE ext_weather_daily;
  ANALYZE ext_market_index;
  ANALYZE ext_events;
  ANALYZE audit_log;
  
  -- 統計情報更新をログ
  INSERT INTO audit_log (
    actor_id, action, target, metadata, ip, user_agent, timestamp
  ) VALUES (
    'system', 'update_statistics', 'database_tables', 
    '{"tables": ["sales", "ext_weather_daily", "ext_market_index", "ext_events", "audit_log"]}',
    '127.0.0.1', 'PostgreSQL/System', NOW()
  );
END;
$$;

-- 統計情報の定期更新スケジュール（例：週1回）
-- SELECT cron.schedule('update-statistics', '0 2 * * 0', 'SELECT update_table_statistics();');

-- ========================================
-- QUERY PERFORMANCE MONITORING
-- ========================================

-- 遅いクエリ監視ビュー
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows
FROM pg_stat_statements 
WHERE mean_time > 1000 -- 1秒以上のクエリ
ORDER BY mean_time DESC
LIMIT 20;

-- データベース統計ビュー
CREATE OR REPLACE VIEW v_database_stats AS
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals
FROM pg_stats 
WHERE schemaname = 'public'
  AND tablename IN ('sales', 'ext_weather_daily', 'ext_market_index', 'ext_events')
ORDER BY tablename, attname;
