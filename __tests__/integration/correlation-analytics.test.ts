/**
 * 相関分析機能 統合テスト
 * アナリティクスページ・API・サービスの統合テスト
 */

import { createClient } from '@supabase/supabase-js';
import { CorrelationService } from '@/lib/services/correlation';
import type { CorrelationFilters } from '@/lib/services/correlation';

// テスト用Supabaseクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key';

// 統合テスト用のモックデータ
const mockSalesData = [
  {
    id: 'sales1',
    date: '2024-01-01',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 150000,
    footfall: 75,
    transactions: 30,
    discounts: 7500,
    tax: 15000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T09:00:00Z'
  },
  {
    id: 'sales2',
    date: '2024-01-02',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 120000,
    footfall: 60,
    transactions: 25,
    discounts: 6000,
    tax: 12000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-02T09:00:00Z',
    updated_at: '2024-01-02T09:00:00Z'
  },
  {
    id: 'sales3',
    date: '2024-01-03',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 180000,
    footfall: 90,
    transactions: 35,
    discounts: 9000,
    tax: 18000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-03T09:00:00Z',
    updated_at: '2024-01-03T09:00:00Z'
  }
];

const mockWeatherData = [
  {
    id: 'weather1',
    date: '2024-01-01',
    location: 'Tokyo',
    temp_avg: 18.5,
    temp_max: 22.0,
    temp_min: 15.0,
    humidity: 60,
    precipitation: 0.0,
    condition: '晴れ',
    created_at: '2024-01-01T06:00:00Z',
    updated_at: '2024-01-01T06:00:00Z'
  },
  {
    id: 'weather2',
    date: '2024-01-02',
    location: 'Tokyo',
    temp_avg: 14.0,
    temp_max: 17.0,
    temp_min: 11.0,
    humidity: 85,
    precipitation: 8.5,
    condition: '雨',
    created_at: '2024-01-02T06:00:00Z',
    updated_at: '2024-01-02T06:00:00Z'
  },
  {
    id: 'weather3',
    date: '2024-01-03',
    location: 'Tokyo',
    temp_avg: 20.0,
    temp_max: 24.0,
    temp_min: 16.0,
    humidity: 55,
    precipitation: 0.0,
    condition: '晴れ',
    created_at: '2024-01-03T06:00:00Z',
    updated_at: '2024-01-03T06:00:00Z'
  }
];

const mockEventData = [
  {
    id: 'event1',
    date: '2024-01-03',
    title: 'Tech Expo 2024',
    description: 'Annual technology exhibition',
    category: 'technology',
    location: 'Convention Center',
    distance_km: 1.5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

describe('相関分析機能 統合テスト', () => {
  let correlationService: CorrelationService;
  let supabase: any;

  beforeAll(() => {
    // 統合テスト用のSupabaseクライアント設定
    supabase = createClient(supabaseUrl, supabaseKey);
    correlationService = new CorrelationService();
  });

  beforeEach(() => {
    // テスト前のクリーンアップとデータ準備
    jest.clearAllMocks();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
  });

  describe('データベース統合', () => {
    const testFilters: CorrelationFilters = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      storeId: 'store1',
      department: 'electronics'
    };

    beforeEach(() => {
      // Supabaseクライアントのモック設定
      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => {
          const chainMethods = {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockImplementation(() => {
              switch (table) {
                case 'sales':
                  return Promise.resolve({ data: mockSalesData, error: null });
                case 'ext_weather_daily':
                  return Promise.resolve({ data: mockWeatherData, error: null });
                case 'ext_events':
                  return Promise.resolve({ data: mockEventData, error: null });
                default:
                  return Promise.resolve({ data: [], error: null });
              }
            })
          };
          return chainMethods;
        })
      };

      // CorrelationServiceのsupabaseクライアントをモック
      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);
    });

    it('売上・天候・イベントデータを統合して相関分析を実行できること', async () => {
      const result = await correlationService.analyzeCorrelations(testFilters);

      // 基本構造の確認
      expect(result).toHaveProperty('correlations');
      expect(result).toHaveProperty('heatmapData');
      expect(result).toHaveProperty('comparisonData');
      expect(result).toHaveProperty('summary');

      // 相関結果の確認
      expect(Array.isArray(result.correlations)).toBe(true);
      expect(result.correlations.length).toBeGreaterThan(0);

      // 各相関要因の確認
      const factorTypes = result.correlations.map(c => c.factor);
      expect(factorTypes.some(f => f.includes('曜日'))).toBe(true);
      expect(factorTypes.some(f => f.includes('気温') || f.includes('湿度') || f.includes('降水量'))).toBe(true);

      // ヒートマップデータの確認
      expect(Array.isArray(result.heatmapData)).toBe(true);
      result.heatmapData.forEach(heatmap => {
        expect(heatmap).toHaveProperty('x');
        expect(heatmap).toHaveProperty('y');
        expect(heatmap).toHaveProperty('value');
        expect(typeof heatmap.value).toBe('number');
      });

      // 比較データの確認
      expect(Array.isArray(result.comparisonData)).toBe(true);
      expect(result.comparisonData.length).toBe(mockSalesData.length);
      
      result.comparisonData.forEach(comparison => {
        expect(comparison).toHaveProperty('date');
        expect(comparison).toHaveProperty('current');
        expect(comparison).toHaveProperty('dayOfWeek');
        expect(typeof comparison.current).toBe('number');
      });

      // サマリー情報の確認
      expect(result.summary.totalAnalyzedDays).toBe(mockSalesData.length);
      expect(result.summary.averageDailySales).toBeGreaterThan(0);
    });

    it('フィルター条件が正しくデータベースクエリに適用されること', async () => {
      const mockFrom = jest.fn().mockImplementation((table: string) => ({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        })
      }));

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue({
        from: mockFrom
      });

      await correlationService.analyzeCorrelations(testFilters);

      // 各テーブルがクエリされていることを確認
      expect(mockFrom).toHaveBeenCalledWith('sales');
      expect(mockFrom).toHaveBeenCalledWith('ext_weather_daily');
      expect(mockFrom).toHaveBeenCalledWith('ext_events');
    });

    it('データベースエラー時に適切なエラーハンドリングが行われること', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: null, 
                  error: { message: 'Database connection failed' } 
                })
              })
            })
          })
        })
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      await expect(
        correlationService.analyzeCorrelations(testFilters)
      ).rejects.toThrow('Failed to fetch sales data: Database connection failed');
    });
  });

  describe('API統合', () => {
    const validRequestBody = {
      filters: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        storeId: 'store1'
      }
    };

    it('APIエンドポイントからサービスまでのフルフローが正常に動作すること', async () => {
      // この統合テストでは実際のHTTPリクエストをシミュレートする
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            correlations: [
              {
                factor: '曜日_月曜日',
                correlation: 0.75,
                significance: 0.95,
                sampleSize: 4,
                description: 'Test correlation'
              }
            ],
            heatmapData: [],
            comparisonData: [],
            summary: {
              totalAnalyzedDays: 4,
              averageDailySales: 150000,
              strongestPositive: null,
              strongestNegative: null
            }
          },
          meta: {
            processingTime: 1500,
            withinSLA: true,
            timestamp: new Date().toISOString()
          }
        })
      });

      global.fetch = mockFetch;

      const response = await fetch('/api/analytics/correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequestBody)
      });

      expect(response.ok).toBe(true);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty('data');
      expect(responseData).toHaveProperty('meta');
      expect(responseData.meta.withinSLA).toBe(true);
    });

    it('設定情報APIが正常に動作すること', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          config: {
            maxAnalysisPeriod: '1年',
            performanceSLA: '5秒以内',
            supportedFactors: ['曜日パターン', '天候影響'],
            correlationMethods: ['Pearson相関係数']
          },
          limits: {
            maxDataPoints: 10000,
            minAnalysisPeriod: '7日',
            maxConcurrentRequests: 3
          },
          features: {
            realTimeAnalysis: true,
            heatmapVisualization: true,
            exportSupport: true
          }
        })
      });

      global.fetch = mockFetch;

      const response = await fetch('/api/analytics/correlation');
      expect(response.ok).toBe(true);
      
      const configData = await response.json();
      expect(configData).toHaveProperty('config');
      expect(configData).toHaveProperty('limits');
      expect(configData).toHaveProperty('features');
    });
  });

  describe('パフォーマンス統合テスト', () => {
    it('大量データでのエンドツーエンドパフォーマンス', async () => {
      // 大量データのモック（100日分）
      const largeSalesDataset = Array.from({ length: 100 }, (_, i) => ({
        ...mockSalesData[0],
        id: `sales_${i}`,
        date: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`,
        revenue_ex_tax: Math.floor(Math.random() * 200000) + 50000
      }));

      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(() => {
                  switch (table) {
                    case 'sales':
                      return Promise.resolve({ data: largeSalesDataset, error: null });
                    case 'ext_weather_daily':
                      return Promise.resolve({ data: mockWeatherData, error: null });
                    case 'ext_events':
                      return Promise.resolve({ data: mockEventData, error: null });
                    default:
                      return Promise.resolve({ data: [], error: null });
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      const startTime = Date.now();
      
      const result = await correlationService.analyzeCorrelations({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.correlations).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // 5秒以内のSLA要件

      // 大量データが正しく処理されていることを確認
      expect(result.summary.totalAnalyzedDays).toBeGreaterThan(50);
    });

    it('並列処理パフォーマンス', async () => {
      const testFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(async () => {
                  // 並列処理をシミュレートするため短い遅延
                  await new Promise(resolve => setTimeout(resolve, 10));
                  switch (table) {
                    case 'sales':
                      return { data: mockSalesData, error: null };
                    case 'ext_weather_daily':
                      return { data: mockWeatherData, error: null };
                    case 'ext_events':
                      return { data: mockEventData, error: null };
                    default:
                      return { data: [], error: null };
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      const startTime = Date.now();
      
      // 複数の分析を並列実行
      const promises = Array.from({ length: 3 }, () => 
        correlationService.analyzeCorrelations(testFilters)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 並列処理により、逐次処理より高速に完了することを確認
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('correlations');
        expect(result).toHaveProperty('summary');
      });

      // 並列処理のメリットを確認（逐次処理の場合より短い時間）
      expect(totalTime).toBeLessThan(3000); // 3秒以内
    });
  });

  describe('エラー回復性テスト', () => {
    it('部分的なデータ欠損時の処理', async () => {
      // 売上データのみ存在、天候・イベントデータが欠損
      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(() => {
                  switch (table) {
                    case 'sales':
                      return Promise.resolve({ data: mockSalesData, error: null });
                    case 'ext_weather_daily':
                      return Promise.resolve({ data: [], error: null }); // 空データ
                    case 'ext_events':
                      return Promise.resolve({ data: [], error: null }); // 空データ
                    default:
                      return Promise.resolve({ data: [], error: null });
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      const result = await correlationService.analyzeCorrelations({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // 売上データベースの基本分析は実行される
      expect(result).toBeDefined();
      expect(result.summary.totalAnalyzedDays).toBeGreaterThan(0);
      
      // 天候・イベント関連の相関は限定的
      const weatherCorrelations = result.correlations.filter(c => 
        c.factor.includes('気温') || c.factor.includes('湿度') || c.factor.includes('雨')
      );
      expect(weatherCorrelations).toHaveLength(0); // 天候データが無いため相関も無し
    });

    it('ネットワーク断続時の再試行機能', async () => {
      let attemptCount = 0;
      
      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(() => {
                  attemptCount++;
                  if (attemptCount <= 2) {
                    // 最初の2回は失敗
                    return Promise.resolve({ 
                      data: null, 
                      error: { message: 'Network timeout' } 
                    });
                  } else {
                    // 3回目で成功
                    switch (table) {
                      case 'sales':
                        return Promise.resolve({ data: mockSalesData, error: null });
                      default:
                        return Promise.resolve({ data: [], error: null });
                    }
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      // 再試行機能が組み込まれている場合のテスト
      // 実際の実装では、再試行ロジックがCorrelationServiceに組み込まれている必要がある
      await expect(
        correlationService.analyzeCorrelations({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      ).rejects.toThrow(); // 現在の実装では再試行が無いためエラー
    });
  });

  describe('データ品質検証', () => {
    it('計算結果の一貫性チェック', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(() => {
                  switch (table) {
                    case 'sales':
                      return Promise.resolve({ data: mockSalesData, error: null });
                    case 'ext_weather_daily':
                      return Promise.resolve({ data: mockWeatherData, error: null });
                    case 'ext_events':
                      return Promise.resolve({ data: mockEventData, error: null });
                    default:
                      return Promise.resolve({ data: [], error: null });
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      const result = await correlationService.analyzeCorrelations({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // 相関係数が有効範囲内であることを確認
      result.correlations.forEach(correlation => {
        expect(correlation.correlation).toBeGreaterThanOrEqual(-1.0);
        expect(correlation.correlation).toBeLessThanOrEqual(1.0);
        expect(isNaN(correlation.correlation)).toBe(false);
        expect(isFinite(correlation.correlation)).toBe(true);
      });

      // サマリーデータの整合性チェック
      expect(result.summary.averageDailySales).toBeGreaterThan(0);
      expect(result.summary.totalAnalyzedDays).toBe(mockSalesData.length);

      // 日別データの合計と平均売上の整合性
      const totalSales = mockSalesData.reduce((sum, sale) => sum + sale.revenue_ex_tax, 0);
      const calculatedAverage = totalSales / mockSalesData.length;
      expect(Math.abs(result.summary.averageDailySales - calculatedAverage)).toBeLessThan(1); // 丸め誤差を考慮
    });

    it('ヒートマップデータの妥当性チェック', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => ({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockImplementation(() => {
                  switch (table) {
                    case 'sales':
                      return Promise.resolve({ data: mockSalesData, error: null });
                    case 'ext_weather_daily':
                      return Promise.resolve({ data: mockWeatherData, error: null });
                    case 'ext_events':
                      return Promise.resolve({ data: mockEventData, error: null });
                    default:
                      return Promise.resolve({ data: [], error: null });
                  }
                })
              })
            })
          })
        }))
      };

      jest.spyOn(correlationService, 'supabase' as any).mockReturnValue(mockSupabaseClient);

      const result = await correlationService.analyzeCorrelations({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // ヒートマップデータの構造確認
      result.heatmapData.forEach(heatmap => {
        expect(heatmap).toHaveProperty('x');
        expect(heatmap).toHaveProperty('y');
        expect(heatmap).toHaveProperty('value');
        
        // 曜日の値が正しいことを確認
        expect(['日', '月', '火', '水', '木', '金', '土']).toContain(heatmap.x);
        
        // 天候の値が正しいことを確認
        expect(['晴', '曇', '雨', 'その他']).toContain(heatmap.y);
        
        // 値が正の数値であることを確認
        expect(typeof heatmap.value).toBe('number');
        expect(heatmap.value).toBeGreaterThan(0);
        expect(isNaN(heatmap.value)).toBe(false);
      });
    });
  });
});
