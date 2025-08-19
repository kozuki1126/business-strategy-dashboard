-- Sample data for development and testing
-- File: supabase/seed.sql

-- ===================================
-- Master Data (Dimensions)
-- ===================================

-- Sample stores
INSERT INTO dim_store (code, name, address, latitude, longitude, area, phone, manager_name, opening_date) VALUES
('STR001', '東京店', '東京都渋谷区渋谷1-1-1', 35.6581, 139.7014, '関東', '03-1234-5678', '田中太郎', '2020-01-15'),
('STR002', '大阪店', '大阪市中央区心斎橋1-1-1', 34.6720, 135.5024, '関西', '06-1234-5678', '佐藤花子', '2020-03-01'),
('STR003', '名古屋店', '名古屋市中区栄1-1-1', 35.1683, 136.9066, '中部', '052-123-4567', '鈴木次郎', '2020-06-10'),
('STR004', '福岡店', '福岡市中央区天神1-1-1', 33.5904, 130.4017, '九州', '092-123-4567', '高橋美咲', '2021-01-20'),
('STR005', '札幌店', '札幌市中央区大通1-1-1', 43.0550, 141.3478, '北海道', '011-123-4567', '伊藤健一', '2021-04-01');

-- Sample departments
INSERT INTO dim_department (code, name, category, sort_order) VALUES
('DEPT001', '家電', 'Electronics', 1),
('DEPT002', 'ファッション', 'Fashion', 2),
('DEPT003', '食品', 'Food', 3),
('DEPT004', '雑貨', 'Miscellaneous', 4),
('DEPT005', 'スポーツ', 'Sports', 5);

-- Sample product categories
INSERT INTO dim_product_category (code, name, department_id, sort_order) VALUES
('CAT001', 'テレビ', (SELECT id FROM dim_department WHERE code = 'DEPT001'), 1),
('CAT002', '冷蔵庫', (SELECT id FROM dim_department WHERE code = 'DEPT001'), 2),
('CAT003', 'エアコン', (SELECT id FROM dim_department WHERE code = 'DEPT001'), 3),
('CAT004', 'メンズウェア', (SELECT id FROM dim_department WHERE code = 'DEPT002'), 1),
('CAT005', 'レディースウェア', (SELECT id FROM dim_department WHERE code = 'DEPT002'), 2),
('CAT006', '生鮮食品', (SELECT id FROM dim_department WHERE code = 'DEPT003'), 1),
('CAT007', '加工食品', (SELECT id FROM dim_department WHERE code = 'DEPT003'), 2),
('CAT008', 'インテリア', (SELECT id FROM dim_department WHERE code = 'DEPT004'), 1),
('CAT009', 'スポーツ用品', (SELECT id FROM dim_department WHERE code = 'DEPT005'), 1);

-- ===================================
-- Sample Sales Data (Last 30 days)
-- ===================================

-- Generate sample sales data for the last 30 days
DO $$
DECLARE
    store_rec RECORD;
    dept_rec RECORD;
    cat_rec RECORD;
    sample_date DATE;
    base_revenue DECIMAL;
    revenue_variation DECIMAL;
    revenue_ex_tax DECIMAL;
    tax_amount DECIMAL;
    footfall_base INTEGER;
    footfall INTEGER;
    transactions INTEGER;
BEGIN
    -- Loop through last 30 days
    FOR i IN 0..29 LOOP
        sample_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        -- Loop through stores
        FOR store_rec IN SELECT * FROM dim_store LOOP
            -- Loop through departments
            FOR dept_rec IN SELECT * FROM dim_department LOOP
                -- Loop through categories in this department
                FOR cat_rec IN SELECT * FROM dim_product_category WHERE department_id = dept_rec.id LOOP
                    
                    -- Generate realistic data based on day of week and store
                    base_revenue := CASE 
                        WHEN EXTRACT(DOW FROM sample_date) IN (0, 6) THEN 150000 -- Weekend
                        ELSE 100000 -- Weekday
                    END;
                    
                    -- Add store-specific variations
                    base_revenue := base_revenue * CASE store_rec.code
                        WHEN 'STR001' THEN 1.5  -- Tokyo (largest)
                        WHEN 'STR002' THEN 1.3  -- Osaka
                        WHEN 'STR003' THEN 1.0  -- Nagoya
                        WHEN 'STR004' THEN 0.8  -- Fukuoka
                        WHEN 'STR005' THEN 0.7  -- Sapporo
                        ELSE 1.0
                    END;
                    
                    -- Add department-specific variations
                    base_revenue := base_revenue * CASE dept_rec.code
                        WHEN 'DEPT001' THEN 1.2  -- Electronics (higher value)
                        WHEN 'DEPT002' THEN 1.0  -- Fashion
                        WHEN 'DEPT003' THEN 0.8  -- Food
                        WHEN 'DEPT004' THEN 0.6  -- Miscellaneous
                        WHEN 'DEPT005' THEN 1.1  -- Sports
                        ELSE 1.0
                    END;
                    
                    -- Add random variation (-20% to +30%)
                    revenue_variation := 0.8 + (RANDOM() * 0.5);
                    revenue_ex_tax := ROUND(base_revenue * revenue_variation / 5); -- Divide by 5 categories
                    tax_amount := ROUND(revenue_ex_tax * 0.1); -- 10% tax
                    
                    -- Calculate footfall and transactions
                    footfall_base := ROUND(revenue_ex_tax / 3000); -- Average 3000 yen per visitor
                    footfall := footfall_base + ROUND(RANDOM() * footfall_base * 0.2); -- ±20% variation
                    transactions := ROUND(footfall * (0.6 + RANDOM() * 0.3)); -- 60-90% conversion
                    
                    -- Insert sales data
                    INSERT INTO sales (
                        date, store_id, department_id, product_category_id,
                        revenue_ex_tax, tax_amount, footfall, transactions,
                        discounts, notes
                    ) VALUES (
                        sample_date,
                        store_rec.id,
                        dept_rec.id,
                        cat_rec.id,
                        revenue_ex_tax,
                        tax_amount,
                        footfall,
                        transactions,
                        ROUND(revenue_ex_tax * 0.05 * RANDOM()), -- Random discounts up to 5%
                        CASE 
                            WHEN RANDOM() < 0.1 THEN 'Special promotion day'
                            WHEN RANDOM() < 0.05 THEN 'System maintenance affected sales'
                            ELSE NULL
                        END
                    );
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- ===================================
-- Sample External Data
-- ===================================

-- Sample market index data (last 30 days)
DO $$
DECLARE
    sample_date DATE;
    topix_base DECIMAL := 2450.0;
    nikkei_base DECIMAL := 33500.0;
    topix_value DECIMAL;
    nikkei_value DECIMAL;
    prev_topix DECIMAL := topix_base;
    prev_nikkei DECIMAL := nikkei_base;
BEGIN
    FOR i IN 29..0 BY -1 LOOP
        sample_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        -- Skip weekends for market data
        IF EXTRACT(DOW FROM sample_date) NOT IN (0, 6) THEN
            -- Generate realistic market movements
            topix_value := prev_topix * (0.995 + RANDOM() * 0.01); -- ±0.5% daily change
            nikkei_value := prev_nikkei * (0.995 + RANDOM() * 0.01);
            
            INSERT INTO ext_market_index (date, index_code, index_name, value, change_value, change_percent) VALUES
            (sample_date, 'TOPIX', 'Tokyo Stock Price Index', ROUND(topix_value, 2), ROUND(topix_value - prev_topix, 2), ROUND(((topix_value - prev_topix) / prev_topix * 100), 4)),
            (sample_date, 'NIKKEI', 'Nikkei 225', ROUND(nikkei_value, 2), ROUND(nikkei_value - prev_nikkei, 2), ROUND(((nikkei_value - prev_nikkei) / prev_nikkei * 100), 4));
            
            prev_topix := topix_value;
            prev_nikkei := nikkei_value;
        END IF;
    END LOOP;
END $$;

-- Sample FX rates (last 30 days)
DO $$
DECLARE
    sample_date DATE;
    usd_jpy_base DECIMAL := 150.0;
    eur_jpy_base DECIMAL := 165.0;
    cny_jpy_base DECIMAL := 21.0;
    usd_jpy DECIMAL;
    eur_jpy DECIMAL;
    cny_jpy DECIMAL;
    prev_usd DECIMAL := usd_jpy_base;
    prev_eur DECIMAL := eur_jpy_base;
    prev_cny DECIMAL := cny_jpy_base;
BEGIN
    FOR i IN 29..0 BY -1 LOOP
        sample_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        -- Generate realistic FX movements
        usd_jpy := prev_usd * (0.998 + RANDOM() * 0.004); -- ±0.2% daily change
        eur_jpy := prev_eur * (0.998 + RANDOM() * 0.004);
        cny_jpy := prev_cny * (0.999 + RANDOM() * 0.002); -- Less volatile
        
        INSERT INTO ext_fx_rate (date, base_currency, target_currency, rate) VALUES
        (sample_date, 'USD', 'JPY', ROUND(usd_jpy, 4)),
        (sample_date, 'EUR', 'JPY', ROUND(eur_jpy, 4)),
        (sample_date, 'CNY', 'JPY', ROUND(cny_jpy, 4));
        
        prev_usd := usd_jpy;
        prev_eur := eur_jpy;
        prev_cny := cny_jpy;
    END LOOP;
END $$;

-- Sample weather data (Tokyo, last 30 days)
DO $$
DECLARE
    sample_date DATE;
    temp_base DECIMAL := 25.0; -- Summer temperature
    temp_max DECIMAL;
    temp_min DECIMAL;
    temp_avg DECIMAL;
    conditions TEXT[] := ARRAY['晴れ', '曇り', '雨', '晴れ時々曇り', '曇り時々雨'];
BEGIN
    FOR i IN 29..0 BY -1 LOOP
        sample_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        temp_max := temp_base + RANDOM() * 8 - 2; -- ±6°C variation from base
        temp_min := temp_max - 5 - RANDOM() * 5; -- 5-10°C difference
        temp_avg := (temp_max + temp_min) / 2;
        
        INSERT INTO ext_weather_daily (
            date, location, temperature_max, temperature_min, temperature_avg,
            humidity_avg, precipitation, weather_condition, weather_code
        ) VALUES (
            sample_date,
            '東京',
            ROUND(temp_max, 1),
            ROUND(temp_min, 1),
            ROUND(temp_avg, 1),
            ROUND(60 + RANDOM() * 30, 1), -- 60-90% humidity
            CASE WHEN RANDOM() < 0.3 THEN ROUND(RANDOM() * 50, 1) ELSE 0 END, -- 30% chance of rain
            conditions[1 + FLOOR(RANDOM() * array_length(conditions, 1))],
            LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')
        );
    END LOOP;
END $$;

-- Sample STEM news
INSERT INTO ext_stem_news (published_date, title, summary, url, source, category, sentiment, keywords) VALUES
(CURRENT_DATE - 1, 'AI技術の最新動向について', '人工知能技術の発展により、ビジネス効率化が加速', 'https://example.com/ai-news-1', 'TechNews Japan', 'AI', 'positive', ARRAY['AI', '人工知能', 'ビジネス', '効率化']),
(CURRENT_DATE - 2, '半導体市場の成長予測', '2025年半導体市場は前年比15%成長の見込み', 'https://example.com/semiconductor-1', 'Market Watch', 'Semiconductor', 'positive', ARRAY['半導体', '市場', '成長', '予測']),
(CURRENT_DATE - 3, 'ロボティクス技術の産業応用', '製造業でのロボット導入が生産性向上に寄与', 'https://example.com/robotics-1', 'Industry Today', 'Robotics', 'positive', ARRAY['ロボット', '製造業', '生産性', '自動化']),
(CURRENT_DATE - 5, 'バイオテクノロジーの新展開', '遺伝子治療技術の実用化が進む', 'https://example.com/biotech-1', 'Bio Science', 'Biotech', 'positive', ARRAY['バイオテクノロジー', '遺伝子治療', '医療', '技術']);

-- Sample audit log entries
INSERT INTO audit_log (actor_email, action, target_type, ip_address, user_agent, metadata) VALUES
('admin@company.com', 'login', 'system', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '{"login_method": "magic_link"}'),
('manager@company.com', 'view', 'dashboard', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '{"page": "sales_dashboard", "filters": {"store": "STR001"}}'),
('staff@company.com', 'input', 'sales', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', '{"amount": 120000, "store": "STR002"}');

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Sample data inserted successfully!';
    RAISE NOTICE 'Stores: % records', (SELECT COUNT(*) FROM dim_store);
    RAISE NOTICE 'Departments: % records', (SELECT COUNT(*) FROM dim_department);
    RAISE NOTICE 'Product Categories: % records', (SELECT COUNT(*) FROM dim_product_category);
    RAISE NOTICE 'Sales Records: % records', (SELECT COUNT(*) FROM sales);
    RAISE NOTICE 'Market Index Records: % records', (SELECT COUNT(*) FROM ext_market_index);
    RAISE NOTICE 'FX Rate Records: % records', (SELECT COUNT(*) FROM ext_fx_rate);
    RAISE NOTICE 'Weather Records: % records', (SELECT COUNT(*) FROM ext_weather_daily);
    RAISE NOTICE 'STEM News Records: % records', (SELECT COUNT(*) FROM ext_stem_news);
    RAISE NOTICE 'Audit Log Records: % records', (SELECT COUNT(*) FROM audit_log);
END $$;
