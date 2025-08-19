-- Enhanced seed data for Business Strategy Dashboard
-- Task #004: データベーススキーマ作成 - 詳細シードデータ拡充
-- Created: 2025-08-19

-- This file expands on the basic seed.sql with more comprehensive test data

-- ========================================
-- EXTENDED MASTER DATA
-- ========================================

-- Add more stores for comprehensive testing
INSERT INTO dim_store (id, name, address, lat, lng, area) VALUES
    ('66666666-6666-6666-6666-666666666666', '名古屋栄店', '愛知県名古屋市中区栄3-1-1', 35.1677, 136.9067, '中部'),
    ('77777777-7777-7777-7777-777777777777', '福岡天神店', '福岡県福岡市中央区天神2-1-1', 33.5904, 130.4017, '九州'),
    ('88888888-8888-8888-8888-888888888888', '札幌すすきの店', '北海道札幌市中央区南4条西4-1', 43.0526, 141.3544, '北海道'),
    ('99999999-9999-9999-9999-999999999999', '仙台一番町店', '宮城県仙台市青葉区一番町3-1-1', 38.2682, 140.8694, '東北'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '京都四条店', '京都府京都市下京区四条通烏丸東', 35.0116, 135.7681, '関西'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '広島本通店', '広島県広島市中区本通1-1', 34.3969, 132.4596, '中国'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '静岡駅前店', '静岡県静岡市葵区御幸町1-1', 34.9756, 138.3829, '中部')
ON CONFLICT (id) DO NOTHING;

-- Add more product categories
INSERT INTO dim_department (name) VALUES
    ('書籍・雑誌'),
    ('化粧品'),
    ('スポーツ用品'),
    ('趣味・ホビー'),
    ('ペット用品'),
    ('旅行用品')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- COMPREHENSIVE SALES DATA (PAST 30 DAYS)
-- ========================================

-- Generate sales data for the past 30 days for all stores
DO $$
DECLARE
    store_rec RECORD;
    date_val DATE;
    dept_names TEXT[] := ARRAY['食品', '雑貨', '衣料', '家電', 'サービス', '書籍・雑誌', '化粧品'];
    categories TEXT[] := ARRAY['おにぎり・弁当', '文具', 'カジュアル', 'PC・スマホ', 'カフェ', '雑誌', 'スキンケア'];
    base_revenue DECIMAL;
    random_factor DECIMAL;
    i INTEGER;
BEGIN
    -- Loop through all stores
    FOR store_rec IN SELECT id, name FROM dim_store LOOP
        -- Loop through past 30 days
        FOR i IN 0..29 LOOP
            date_val := CURRENT_DATE - i;
            
            -- Skip if data already exists
            IF NOT EXISTS (SELECT 1 FROM sales WHERE store_id = store_rec.id AND date = date_val) THEN
                -- Generate 3-5 random sales records per store per day
                FOR j IN 1..(3 + (i % 3)) LOOP
                    -- Calculate base revenue with store and day variations
                    base_revenue := CASE 
                        WHEN store_rec.name LIKE '%渋谷%' THEN 120000 + (random() * 50000)
                        WHEN store_rec.name LIKE '%新宿%' THEN 140000 + (random() * 60000)
                        WHEN store_rec.name LIKE '%大阪%' THEN 110000 + (random() * 45000)
                        ELSE 80000 + (random() * 40000)
                    END;
                    
                    -- Add day-of-week variation (weekends +20%, weekdays normal)
                    IF EXTRACT(DOW FROM date_val) IN (0, 6) THEN -- Sunday = 0, Saturday = 6
                        base_revenue := base_revenue * 1.2;
                    END IF;
                    
                    -- Add weather effect simulation (random -10% to +5%)
                    random_factor := 0.9 + (random() * 0.15);
                    base_revenue := base_revenue * random_factor;
                    
                    INSERT INTO sales (
                        date, store_id, department, product_category,
                        revenue_ex_tax, footfall, transactions, discounts, tax, notes
                    ) VALUES (
                        date_val,
                        store_rec.id,
                        dept_names[1 + (j % array_length(dept_names, 1))],
                        categories[1 + (j % array_length(categories, 1))],
                        ROUND(base_revenue, 2),
                        FLOOR(100 + (random() * 500))::INTEGER,
                        FLOOR(50 + (random() * 200))::INTEGER,
                        ROUND(base_revenue * (0.01 + random() * 0.04), 2), -- 1-5% discounts
                        ROUND(base_revenue * 0.1, 2), -- 10% tax
                        CASE 
                            WHEN i < 7 THEN '最新データ'
                            WHEN i < 14 THEN '先週データ'
                            ELSE '過去データ'
                        END
                    )
                    ON CONFLICT (store_id, date, department, product_category) DO NOTHING;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ========================================
-- EXTENDED EXTERNAL DATA
-- ========================================

-- Extended market index data (past 30 days)
DO $$
DECLARE
    date_val DATE;
    symbols TEXT[] := ARRAY['TOPIX', 'NIKKEI225', '7203', '6758', '9984', '4755', '6861'];
    base_values DECIMAL[] := ARRAY[2450.0, 36200.0, 1520.0, 4560.0, 8760.0, 12500.0, 850.0];
    i INTEGER;
    j INTEGER;
    current_value DECIMAL;
    change_pct DECIMAL;
BEGIN
    FOR i IN 0..29 LOOP
        date_val := CURRENT_DATE - i;
        
        FOR j IN 1..array_length(symbols, 1) LOOP
            -- Skip weekends for stock data
            IF EXTRACT(DOW FROM date_val) NOT IN (0, 6) THEN
                -- Calculate realistic price movement
                change_pct := (random() - 0.5) * 4; -- -2% to +2% daily change
                current_value := base_values[j] * (1 + (change_pct / 100));
                
                INSERT INTO ext_market_index (date, symbol, value, change_percent) VALUES (
                    date_val,
                    symbols[j],
                    ROUND(current_value, 2),
                    ROUND(change_pct, 2)
                )
                ON CONFLICT (date, symbol) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Extended FX rates (past 30 days)
DO $$
DECLARE
    date_val DATE;
    pairs TEXT[] := ARRAY['USD/JPY', 'EUR/JPY', 'CNY/JPY', 'GBP/JPY', 'AUD/JPY'];
    base_rates DECIMAL[] := ARRAY[145.50, 159.20, 20.30, 185.40, 96.80];
    i INTEGER;
    j INTEGER;
    current_rate DECIMAL;
    change_pct DECIMAL;
BEGIN
    FOR i IN 0..29 LOOP
        date_val := CURRENT_DATE - i;
        
        FOR j IN 1..array_length(pairs, 1) LOOP
            change_pct := (random() - 0.5) * 2; -- -1% to +1% daily change
            current_rate := base_rates[j] * (1 + (change_pct / 100));
            
            INSERT INTO ext_fx_rate (date, pair, rate, change_percent) VALUES (
                date_val,
                pairs[j],
                ROUND(current_rate, 4),
                ROUND(change_pct, 2)
            )
            ON CONFLICT (date, pair) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Extended weather data (past 30 days)
DO $$
DECLARE
    date_val DATE;
    locations TEXT[] := ARRAY['東京', '大阪', '横浜', '名古屋', '福岡', '札幌', '仙台', '京都', '広島', '静岡'];
    weather_conditions TEXT[] := ARRAY['sunny', 'cloudy', 'partly_cloudy', 'light_rain', 'heavy_rain', 'snow'];
    i INTEGER;
    j INTEGER;
    temp_max DECIMAL;
    temp_min DECIMAL;
    precipitation DECIMAL;
    humidity DECIMAL;
    condition TEXT;
BEGIN
    FOR i IN 0..29 LOOP
        date_val := CURRENT_DATE - i;
        
        FOR j IN 1..array_length(locations, 1) LOOP
            -- Generate realistic weather data based on season and location
            temp_max := CASE 
                WHEN locations[j] = '札幌' THEN 25 + (random() * 10)
                WHEN locations[j] IN ('東京', '大阪', '横浜') THEN 30 + (random() * 8)
                ELSE 28 + (random() * 10)
            END;
            
            temp_min := temp_max - (5 + random() * 8);
            precipitation := CASE WHEN random() < 0.3 THEN random() * 15 ELSE 0 END;
            humidity := 50 + (random() * 40);
            condition := weather_conditions[1 + (FLOOR(random() * array_length(weather_conditions, 1)))::INTEGER];
            
            INSERT INTO ext_weather_daily (
                date, location, temperature_max, temperature_min, 
                precipitation_mm, humidity_percent, weather_condition
            ) VALUES (
                date_val,
                locations[j],
                ROUND(temp_max, 1),
                ROUND(temp_min, 1),
                ROUND(precipitation, 1),
                ROUND(humidity, 1),
                condition
            )
            ON CONFLICT (date, location) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ========================================
-- REALISTIC EVENT DATA
-- ========================================

-- Add various types of events around store locations
INSERT INTO ext_events (date, title, location, lat, lng, event_type, expected_attendance, notes) VALUES
    -- Tokyo area events
    (CURRENT_DATE + 1, '東京マラソン', '東京都千代田区', 35.6762, 139.6503, 'sports', 38000, '大規模スポーツイベント'),
    (CURRENT_DATE + 2, '表参道アートフェス', '東京都渋谷区表参道', 35.6654, 139.7096, 'exhibition', 15000, 'アート展示'),
    (CURRENT_DATE + 3, '新宿音楽祭', '東京都新宿区歌舞伎町', 35.6944, 139.7031, 'concert', 8000, '音楽イベント'),
    (CURRENT_DATE + 5, '池袋グルメフェア', '東京都豊島区池袋', 35.7280, 139.7109, 'food', 12000, 'グルメイベント'),
    
    -- Osaka area events  
    (CURRENT_DATE + 1, '大阪城桜祭り', '大阪府大阪市中央区大阪城', 34.6873, 135.5262, 'festival', 25000, '桜の季節'),
    (CURRENT_DATE + 4, '道頓堀フードフェス', '大阪府大阪市中央区道頓堀', 34.6686, 135.5023, 'food', 18000, '関西グルメ'),
    
    -- Other cities
    (CURRENT_DATE + 2, '横浜赤レンガ倉庫イベント', '神奈川県横浜市中区新港', 35.4530, 139.6317, 'exhibition', 10000, 'みなとみらい'),
    (CURRENT_DATE + 6, '名古屋城夏祭り', '愛知県名古屋市中区本丸', 35.1856, 136.8991, 'festival', 20000, '夏の祭典'),
    (CURRENT_DATE + 3, '福岡アジアンフェス', '福岡県福岡市博多区', 33.5904, 130.4017, 'cultural', 7000, 'アジア文化交流'),
    (CURRENT_DATE + 7, '札幌雪祭り準備', '北海道札幌市中央区大通', 43.0642, 141.3469, 'festival', 5000, '準備期間')
ON CONFLICT DO NOTHING;

-- ========================================
-- EXTENDED INBOUND TOURISM DATA
-- ========================================

-- Add more detailed inbound tourism statistics
INSERT INTO ext_inbound (year_month, country, visitors, change_percent, prefecture) VALUES
    -- 2025 data
    ('2025-06', '中国', 145230, 8.7, '全国'),
    ('2025-06', '韓国', 218940, 12.3, '全国'),
    ('2025-06', '台湾', 138760, 18.9, '全国'),
    ('2025-06', 'アメリカ', 87240, 15.6, '全国'),
    ('2025-06', 'タイ', 65430, 22.1, '全国'),
    ('2025-06', 'ベトナム', 45670, 28.4, '全国'),
    
    -- Prefecture breakdown
    ('2025-06', '中国', 42340, 15.2, '東京都'),
    ('2025-06', '韓国', 63280, 9.8, '東京都'),
    ('2025-06', '台湾', 38450, 21.3, '東京都'),
    ('2025-06', '中国', 21560, 12.4, '大阪府'),
    ('2025-06', '韓国', 31240, 16.7, '大阪府'),
    ('2025-06', '中国', 8720, 5.3, '神奈川県'),
    ('2025-06', '韓国', 12450, 8.9, '神奈川県'),
    
    -- Historical comparison data
    ('2025-05', '中国', 139840, 5.2, '全国'),
    ('2025-05', '韓国', 205670, 7.8, '全国'),
    ('2025-04', '中国', 132450, 3.1, '全国'),
    ('2025-04', '韓国', 198320, 4.6, '全国')
ON CONFLICT (year_month, country, prefecture) DO NOTHING;

-- ========================================
-- COMPREHENSIVE STEM NEWS DATA
-- ========================================

-- Add more STEM news articles covering different categories and time periods
INSERT INTO ext_stem_news (published_date, title, source, category, url, summary, sentiment_score) VALUES
    -- AI category
    (CURRENT_DATE - 1, 'ChatGPT新機能で小売業界に革命', 'AI Weekly', 'AI', 'https://example.com/ai-retail', 'AIチャットボットが小売業の顧客サービスを変革している', 0.8),
    (CURRENT_DATE - 3, '画像認識AI、精度99%達成', 'Tech Innovation', 'AI', 'https://example.com/image-ai', '最新の画像認識技術が医療診断分野で活用開始', 0.9),
    (CURRENT_DATE - 5, 'AI倫理規制、業界への影響懸念', 'Business Tech', 'AI', 'https://example.com/ai-ethics', '新しいAI規制がテック業界に与える影響を分析', -0.2),
    
    -- Semiconductor category
    (CURRENT_DATE - 2, 'TSMC、3nm製造で新記録', 'Semiconductor Today', 'semiconductor', 'https://example.com/tsmc-3nm', 'TSMCが3nmプロセスで歩留まり90%を達成', 0.7),
    (CURRENT_DATE - 4, '半導体不足、徐々に改善傾向', 'Industry Report', 'semiconductor', 'https://example.com/chip-shortage', '自動車・家電業界での半導体供給が回復基調', 0.6),
    (CURRENT_DATE - 7, '量子チップ開発で日本がリード', 'Quantum News', 'semiconductor', 'https://example.com/quantum-japan', '日本の研究機関が量子コンピュータ用チップで成果', 0.8),
    
    -- Robotics category
    (CURRENT_DATE - 1, 'ヒューマノイドロボット、工場導入加速', 'Robotics World', 'robotics', 'https://example.com/humanoid-factory', '製造業でのヒューマノイドロボット活用が急速に拡大', 0.7),
    (CURRENT_DATE - 6, '介護ロボット、実用化へ前進', 'Healthcare Tech', 'robotics', 'https://example.com/care-robot', '高齢化社会で介護支援ロボットの需要が急増', 0.8),
    (CURRENT_DATE - 8, 'ドローン配送、都市部で本格開始', 'Logistics Innovation', 'robotics', 'https://example.com/drone-delivery', '都市部でのドローン配送サービスが商用化', 0.6),
    
    -- Biotech category
    (CURRENT_DATE - 2, '遺伝子治療、がん治療で画期的成果', 'BioMedicine', 'biotech', 'https://example.com/gene-therapy', '新しい遺伝子治療法が臨床試験で高い効果を示す', 0.9),
    (CURRENT_DATE - 5, 'mRNA技術、ワクチン以外にも応用拡大', 'Bio Innovation', 'biotech', 'https://example.com/mrna-expansion', 'mRNA技術がアレルギー治療などに応用される', 0.8),
    (CURRENT_DATE - 9, 'バイオ燃料生産、コスト大幅削減', 'Green Energy', 'biotech', 'https://example.com/biofuel-cost', '微生物を使ったバイオ燃料生産技術が向上', 0.7)
ON CONFLICT DO NOTHING;

-- ========================================
-- COMPREHENSIVE AUDIT LOG DATA
-- ========================================

-- Add more audit log entries for system monitoring
INSERT INTO audit_log (actor_id, action, target, ip, ua, meta) VALUES
    (NULL, 'migration_applied', 'enhanced_schema_optimization', '127.0.0.1', 'Supabase-Migration', 
     '{"migration": "enhanced_schema_optimization", "version": "20250819080000", "constraints_added": 15, "indexes_added": 12}'),
    (NULL, 'seed_data_extended', 'all_tables', '127.0.0.1', 'Supabase-Seed', 
     '{"operation": "extended_seed", "stores_added": 7, "sales_records": 500, "external_data_points": 200}'),
    (NULL, 'performance_indexes_created', 'database', '127.0.0.1', 'System', 
     '{"indexes_created": 12, "estimated_performance_improvement": "40%"}'),
    (NULL, 'rls_prepared', 'security', '127.0.0.1', 'System', 
     '{"roles_created": 4, "policies_prepared": 3, "status": "ready_for_phase1"}')
ON CONFLICT DO NOTHING;

-- ========================================
-- VERIFICATION AND STATISTICS
-- ========================================

-- Update table statistics for query planner
ANALYZE;

-- Log completion
INSERT INTO audit_log (actor_id, action, target, meta) VALUES
    (NULL, 'extended_seed_completed', 'task_004', 
     jsonb_build_object(
         'task', '#004 データベーススキーマ作成',
         'completion_time', NOW(),
         'total_sales_records', (SELECT COUNT(*) FROM sales),
         'total_stores', (SELECT COUNT(*) FROM dim_store),
         'total_external_records', (
             (SELECT COUNT(*) FROM ext_market_index) +
             (SELECT COUNT(*) FROM ext_fx_rate) +
             (SELECT COUNT(*) FROM ext_weather_daily) +
             (SELECT COUNT(*) FROM ext_events) +
             (SELECT COUNT(*) FROM ext_inbound) +
             (SELECT COUNT(*) FROM ext_stem_news)
         )
     )
);

-- Show final statistics (commented out for production)
/*
SELECT 'Sales Records' as table_name, COUNT(*) as record_count FROM sales
UNION ALL
SELECT 'Stores', COUNT(*) FROM dim_store
UNION ALL  
SELECT 'Market Index', COUNT(*) FROM ext_market_index
UNION ALL
SELECT 'FX Rates', COUNT(*) FROM ext_fx_rate
UNION ALL
SELECT 'Weather Data', COUNT(*) FROM ext_weather_daily
UNION ALL
SELECT 'Events', COUNT(*) FROM ext_events
UNION ALL
SELECT 'Inbound Tourism', COUNT(*) FROM ext_inbound
UNION ALL
SELECT 'STEM News', COUNT(*) FROM ext_stem_news
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM audit_log
ORDER BY record_count DESC;
*/
