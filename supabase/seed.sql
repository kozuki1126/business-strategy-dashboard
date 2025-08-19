-- Seed data for Business Strategy Dashboard
-- Task #003: Supabase初期化
-- Created: 2025-08-19

-- Insert seed data for testing and development

-- ========================================
-- MASTER DATA SEEDING
-- ========================================

-- Insert sample stores
INSERT INTO dim_store (id, name, address, lat, lng, area) VALUES
    ('11111111-1111-1111-1111-111111111111', '渋谷店', '東京都渋谷区渋谷1-1-1', 35.6595, 139.7006, '東京'),
    ('22222222-2222-2222-2222-222222222222', '新宿店', '東京都新宿区新宿3-1-1', 35.6896, 139.7006, '東京'),
    ('33333333-3333-3333-3333-333333333333', '池袋店', '東京都豊島区池袋2-1-1', 35.7295, 139.7109, '東京'),
    ('44444444-4444-4444-4444-444444444444', '大阪梅田店', '大阪府大阪市北区梅田1-1-1', 34.7024, 135.4959, '関西'),
    ('55555555-5555-5555-5555-555555555555', '横浜店', '神奈川県横浜市西区みなとみらい1-1-1', 35.4560, 139.6282, '関東')
ON CONFLICT (id) DO NOTHING;

-- Insert sample departments
INSERT INTO dim_department (id, name) VALUES
    ('aaa00000-0000-0000-0000-000000000000', '食品'),
    ('bbb00000-0000-0000-0000-000000000000', '雑貨'),
    ('ccc00000-0000-0000-0000-000000000000', '衣料'),
    ('ddd00000-0000-0000-0000-000000000000', '家電'),
    ('eee00000-0000-0000-0000-000000000000', 'サービス')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- SAMPLE SALES DATA
-- ========================================

-- Insert sample sales data for the past week
INSERT INTO sales (
    date, store_id, department, product_category, 
    revenue_ex_tax, footfall, transactions, discounts, tax, notes
) VALUES
    -- 渋谷店のデータ
    ('2025-08-12', '11111111-1111-1111-1111-111111111111', '食品', 'おにぎり・弁当', 125000.00, 450, 320, 2500.00, 12500.00, 'お盆期間前'),
    ('2025-08-13', '11111111-1111-1111-1111-111111111111', '食品', 'おにぎり・弁当', 135000.00, 480, 340, 3000.00, 13500.00, 'お盆開始'),
    ('2025-08-12', '11111111-1111-1111-1111-111111111111', '雑貨', '文具', 78000.00, 180, 95, 1200.00, 7800.00, '新学期需要'),
    
    -- 新宿店のデータ
    ('2025-08-12', '22222222-2222-2222-2222-222222222222', '食品', 'おにぎり・弁当', 145000.00, 520, 380, 2800.00, 14500.00, '平日昼'),
    ('2025-08-13', '22222222-2222-2222-2222-222222222222', '食品', 'おにぎり・弁当', 155000.00, 580, 420, 3200.00, 15500.00, '観光客増'),
    ('2025-08-12', '22222222-2222-2222-2222-222222222222', '衣料', 'カジュアル', 98000.00, 150, 45, 5000.00, 9800.00, '夏物セール'),
    
    -- 池袋店のデータ
    ('2025-08-12', '33333333-3333-3333-3333-333333333333', '家電', 'PC・スマホ', 245000.00, 85, 12, 8000.00, 24500.00, '新製品発売'),
    ('2025-08-13', '33333333-3333-3333-3333-333333333333', '家電', 'PC・スマホ', 189000.00, 65, 9, 5000.00, 18900.00, '通常営業'),
    
    -- 大阪梅田店のデータ
    ('2025-08-12', '44444444-4444-4444-4444-444444444444', '食品', 'おにぎり・弁当', 112000.00, 410, 290, 2200.00, 11200.00, '関西圏'),
    ('2025-08-13', '44444444-4444-4444-4444-444444444444', '食品', 'おにぎり・弁当', 128000.00, 450, 310, 2600.00, 12800.00, 'お盆期間'),
    
    -- 横浜店のデータ
    ('2025-08-12', '55555555-5555-5555-5555-555555555555', 'サービス', 'カフェ', 89000.00, 280, 150, 1500.00, 8900.00, 'みなとみらい観光'),
    ('2025-08-13', '55555555-5555-5555-5555-555555555555', 'サービス', 'カフェ', 95000.00, 320, 180, 1800.00, 9500.00, '週末効果')
ON CONFLICT (store_id, date, department, product_category) DO NOTHING;

-- ========================================
-- SAMPLE EXTERNAL DATA
-- ========================================

-- Sample market index data
INSERT INTO ext_market_index (date, symbol, value, change_percent) VALUES
    ('2025-08-12', 'TOPIX', 2456.78, 0.15),
    ('2025-08-13', 'TOPIX', 2445.32, -0.47),
    ('2025-08-12', 'NIKKEI225', 36234.56, 0.28),
    ('2025-08-13', 'NIKKEI225', 36089.45, -0.40),
    ('2025-08-12', '7203', 1523.50, 1.20), -- Toyota
    ('2025-08-13', '7203', 1534.75, 0.74),
    ('2025-08-12', '6758', 4567.00, -0.85), -- Sony
    ('2025-08-13', '6758', 4523.25, -0.96),
    ('2025-08-12', '9984', 8765.00, 2.34), -- SoftBank
    ('2025-08-13', '9984', 8934.25, 1.93)
ON CONFLICT (date, symbol) DO NOTHING;

-- Sample FX rates
INSERT INTO ext_fx_rate (date, pair, rate, change_percent) VALUES
    ('2025-08-12', 'USD/JPY', 145.67, 0.12),
    ('2025-08-13', 'USD/JPY', 146.23, 0.38),
    ('2025-08-12', 'EUR/JPY', 159.45, -0.25),
    ('2025-08-13', 'EUR/JPY', 158.89, -0.35),
    ('2025-08-12', 'CNY/JPY', 20.34, 0.45),
    ('2025-08-13', 'CNY/JPY', 20.56, 1.08)
ON CONFLICT (date, pair) DO NOTHING;

-- Sample weather data
INSERT INTO ext_weather_daily (date, location, temperature_max, temperature_min, precipitation_mm, humidity_percent, weather_condition) VALUES
    ('2025-08-12', '東京', 32.5, 26.8, 0.0, 68.0, 'sunny'),
    ('2025-08-13', '東京', 31.2, 25.4, 2.3, 72.0, 'cloudy'),
    ('2025-08-12', '大阪', 34.1, 28.2, 0.0, 65.0, 'sunny'),
    ('2025-08-13', '大阪', 33.8, 27.9, 0.5, 69.0, 'partly_cloudy'),
    ('2025-08-12', '横浜', 31.8, 26.2, 0.0, 70.0, 'sunny'),
    ('2025-08-13', '横浜', 30.9, 25.1, 3.1, 75.0, 'light_rain')
ON CONFLICT (date, location) DO NOTHING;

-- Sample local events
INSERT INTO ext_events (date, title, location, lat, lng, event_type, expected_attendance, notes) VALUES
    ('2025-08-13', '渋谷夏祭り', '渋谷センター街', 35.6595, 139.7006, 'festival', 5000, '歩行者天国'),
    ('2025-08-14', 'みなとみらいコンサート', 'パシフィコ横浜', 35.4560, 139.6282, 'concert', 12000, 'アニメソングフェス'),
    ('2025-08-15', '池袋サンシャインイベント', 'サンシャインシティ', 35.7295, 139.7109, 'exhibition', 8000, 'ゲーム展示会'),
    ('2025-08-12', '新宿花火大会', '新宿中央公園', 35.6896, 139.7006, 'fireworks', 15000, 'お盆特別企画')
ON CONFLICT DO NOTHING;

-- Sample inbound tourism data
INSERT INTO ext_inbound (year_month, country, visitors, change_percent, prefecture) VALUES
    ('2025-07', '中国', 156780, 12.5, '全国'),
    ('2025-07', '韓国', 234560, 8.3, '全国'),
    ('2025-07', '台湾', 145670, 15.2, '全国'),
    ('2025-07', 'アメリカ', 89450, 22.1, '全国'),
    ('2025-07', '中国', 45230, 18.7, '東京都'),
    ('2025-07', '韓国', 67890, 11.2, '東京都'),
    ('2025-07', '中国', 23456, 9.8, '大阪府'),
    ('2025-07', '韓国', 34567, 14.3, '大阪府')
ON CONFLICT (year_month, country, prefecture) DO NOTHING;

-- Sample STEM news
INSERT INTO ext_stem_news (published_date, title, source, category, url, summary, sentiment_score) VALUES
    ('2025-08-12', 'AIチップ開発で新たなブレークスルー', '日経新聞', 'AI', 'https://example.com/ai-news1', '新しいAIチップが従来比10倍の性能向上を実現', 0.8),
    ('2025-08-13', '半導体市場、第3四半期は回復傾向', 'テック情報', 'semiconductor', 'https://example.com/semi-news1', '世界的な半導体需要が回復基調に', 0.6),
    ('2025-08-11', 'ロボット技術、製造業での活用拡大', 'ロボット産業新聞', 'robotics', 'https://example.com/robot-news1', '製造業でのロボット導入が加速している', 0.7),
    ('2025-08-10', 'バイオテック分野への投資が増加', 'BioToday', 'biotech', 'https://example.com/bio-news1', 'バイオテクノロジー分野への投資額が過去最高を記録', 0.9)
ON CONFLICT DO NOTHING;

-- ========================================
-- SAMPLE AUDIT LOGS
-- ========================================

-- Sample audit log entries
INSERT INTO audit_log (actor_id, action, target, ip, ua, meta) VALUES
    (NULL, 'system_init', 'database', '127.0.0.1', 'Supabase-Migration', '{"migration": "initial_schema", "version": "20250819040000"}'),
    (NULL, 'seed_data', 'all_tables', '127.0.0.1', 'Supabase-Seed', '{"tables": ["dim_store", "dim_department", "sales", "ext_market_index", "ext_fx_rate", "ext_weather_daily", "ext_events", "ext_inbound", "ext_stem_news"], "records_inserted": 50}')
ON CONFLICT DO NOTHING;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- These are comments for manual verification after seed execution
-- SELECT COUNT(*) FROM dim_store; -- Expected: 5
-- SELECT COUNT(*) FROM dim_department; -- Expected: 5 
-- SELECT COUNT(*) FROM sales; -- Expected: 12
-- SELECT COUNT(*) FROM ext_market_index; -- Expected: 10
-- SELECT COUNT(*) FROM ext_fx_rate; -- Expected: 6
-- SELECT COUNT(*) FROM ext_weather_daily; -- Expected: 6
-- SELECT COUNT(*) FROM ext_events; -- Expected: 4
-- SELECT COUNT(*) FROM ext_inbound; -- Expected: 8
-- SELECT COUNT(*) FROM ext_stem_news; -- Expected: 4
-- SELECT COUNT(*) FROM audit_log; -- Expected: 2
