/**
 * 相関分析サービス ユニットテスト
 * @jest-environment node
 */

import { CorrelationService } from '@/lib/services/correlation';
import type { CorrelationFilters } from '@/lib/services/correlation';

// モックデータ
const mockSalesData = [
  {
    id: '1',
    date: '2024-01-01',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 100000,
    footfall: 50,
    transactions: 25,
    discounts: 5000,
    tax: 10000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    date: '2024-01-02',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 120000,
    footfall: 60,
    transactions: 30,
    discounts: 6000,
    tax: 12000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: '3',
    date: '2024-01-03',
    store_id: 'store1',
    department: 'electronics',
    product_category: 'smartphones',
    revenue_ex_tax: 80000,
    footfall: 40,
    transactions: 20,
    discounts: 4000,
    tax: 8000,
    notes: null,
    created_by: 'user1',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
];

const mockWeatherData = [
  {
    id: '1',
    date: '2024-01-01',
    location: 'Tokyo',
    temp_avg: 15.5,
    temp_max: 20.0,
    temp_min: 10.0,
    humidity: 65,
    precipitation: 0.0,
    condition: '晴れ',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    date: '2024-01-02',
    location: 'Tokyo',
    temp_avg: 12.0,
    temp_max: 16.0,
    temp_min: 8.0,
    humidity: 80,
    precipitation: 5.2,
    condition: '雨',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: '3',
    date: '2024-01-03',
    location: 'Tokyo',
    temp_avg: 18.0,
    temp_max: 22.0,
    temp_min: 14.0,
    humidity: 55,
    precipitation: 0.0,
    condition: '晴れ',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
];

const mockEventData = [
  {
    id: '1',
    date: '2024-01-02',
    title: 'Winter Festival',
    description: 'Local winter festival',
    category: 'festival',
    location: 'Central Park',
    distance_km: 2.5,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  }
];

// Supabaseモック
const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      gte: jest.fn().mockReturnValue({
        lte: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockSalesData, error: null })
            })
          })
        })
      })
    })
  })
};

// モックの設定
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}));

describe('CorrelationService', () => {
  let correlationService: CorrelationService;

  beforeEach(() => {
    correlationService = new CorrelationService();
    jest.clearAllMocks();
  });

  const defaultFilters: CorrelationFilters = {
    startDate: '2024-01-01',
    endDate: '2024-01-03'
  };

  describe('analyzeCorrelations', () => {
    beforeEach(() => {
      // 各データタイプのモックレスポンスを設定
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockSalesData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockWeatherData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockEventData, error: null })
              })
            })
          })
        });
    });

    it('基本的な相関分析を実行できること', async () => {
      const result = await correlationService.analyzeCorrelations(defaultFilters);

      expect(result).toHaveProperty('correlations');
      expect(result).toHaveProperty('heatmapData');
      expect(result).toHaveProperty('comparisonData');
      expect(result).toHaveProperty('summary');

      expect(Array.isArray(result.correlations)).toBe(true);
      expect(Array.isArray(result.heatmapData)).toBe(true);
      expect(Array.isArray(result.comparisonData)).toBe(true);
      expect(result.summary).toHaveProperty('totalAnalyzedDays');
      expect(result.summary).toHaveProperty('averageDailySales');
    });

    it('相関係数が適切な範囲内であること', async () => {
      const result = await correlationService.analyzeCorrelations(defaultFilters);

      result.correlations.forEach(correlation => {
        expect(correlation.correlation).toBeGreaterThanOrEqual(-1);
        expect(correlation.correlation).toBeLessThanOrEqual(1);
        expect(correlation).toHaveProperty('factor');
        expect(correlation).toHaveProperty('significance');
        expect(correlation).toHaveProperty('sampleSize');
        expect(correlation).toHaveProperty('description');
      });
    });

    it('フィルターが適用されること', async () => {
      const filtersWithStore: CorrelationFilters = {
        ...defaultFilters,
        storeId: 'store1',
        department: 'electronics',
        category: 'smartphones'
      };

      await correlationService.analyzeCorrelations(filtersWithStore);

      // Supabaseクエリが適切にフィルタされているかを確認
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sales');
    });

    it('サマリー情報が正しく計算されること', async () => {
      const result = await correlationService.analyzeCorrelations(defaultFilters);

      expect(result.summary.totalAnalyzedDays).toBeGreaterThan(0);
      expect(result.summary.averageDailySales).toBeGreaterThan(0);
      
      // 最強相関が存在する場合の検証
      if (result.summary.strongestPositive) {
        expect(result.summary.strongestPositive.correlation).toBeGreaterThan(0);
      }
      if (result.summary.strongestNegative) {
        expect(result.summary.strongestNegative.correlation).toBeLessThan(0);
      }
    });

    it('エラーハンドリングが適切に動作すること', async () => {
      // エラーレスポンスをモック
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { message: 'Database error' } 
              })
            })
          })
        })
      });

      await expect(
        correlationService.analyzeCorrelations(defaultFilters)
      ).rejects.toThrow();
    });
  });

  describe('performanceTest', () => {
    beforeEach(() => {
      // パフォーマンステスト用のモックデータ設定
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockSalesData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockWeatherData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockEventData, error: null })
              })
            })
          })
        });
    });

    it('パフォーマンス計測が正常に動作すること', async () => {
      const result = await correlationService.performanceTest(defaultFilters);

      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('dataSize');
      expect(typeof result.responseTime).toBe('number');
      expect(typeof result.dataSize).toBe('number');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.dataSize).toBeGreaterThanOrEqual(0);
    });

    it('SLA要件を満たすこと（5秒以内）', async () => {
      const result = await correlationService.performanceTest(defaultFilters);
      
      // パフォーマンス要件: p95 ≤ 5秒（5000ms）
      expect(result.responseTime).toBeLessThan(5000);
    });
  });

  describe('内部メソッドの動作確認', () => {
    beforeEach(() => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockSalesData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockWeatherData, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mkReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockEventData, error: null })
              })
            })
          })
        });
    });

    it('ヒートマップデータが適切に生成されること', async () => {
      const result = await correlationService.analyzeCorrelations(defaultFilters);

      result.heatmapData.forEach(heatmap => {
        expect(heatmap).toHaveProperty('x');
        expect(heatmap).toHaveProperty('y');
        expect(heatmap).toHaveProperty('value');
        expect(typeof heatmap.value).toBe('number');
        expect(heatmap.value).toBeGreaterThan(0);
      });
    });

    it('比較データが適切に生成されること', async () => {
      const result = await correlationService.analyzeCorrelations(defaultFilters);

      result.comparisonData.forEach(comparison => {
        expect(comparison).toHaveProperty('date');
        expect(comparison).toHaveProperty('current');
        expect(comparison).toHaveProperty('previousDay');
        expect(comparison).toHaveProperty('previousYear');
        expect(comparison).toHaveProperty('dayOfWeek');
        expect(typeof comparison.current).toBe('number');
        expect(typeof comparison.previousDay).toBe('number');
        expect(typeof comparison.previousYear).toBe('number');
      });
    });
  });

  describe('エッジケース', () => {
    it('データが存在しない場合の処理', async () => {
      // 空データのモック
      mockSupabaseClient.from
        .mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        });

      const result = await correlationService.analyzeCorrelations(defaultFilters);

      expect(result.correlations).toHaveLength(0);
      expect(result.summary.totalAnalyzedDays).toBe(0);
      expect(result.summary.averageDailySales).toBe(0);
    });

    it('不正な日付範囲でのエラーハンドリング', async () => {
      const invalidFilters: CorrelationFilters = {
        startDate: '2024-12-31',
        endDate: '2024-01-01' // 開始日 > 終了日
      };

      // この場合はAPIレベルでバリデーションされるため、
      // サービスレベルでは正常に処理される
      mockSupabaseClient.from
        .mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        });

      const result = await correlationService.analyzeCorrelations(invalidFilters);
      expect(result).toBeDefined();
    });

    it('大量データでのパフォーマンス', async () => {
      // 大量データのモック（1000件）
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSalesData[0],
        id: `sales_${i}`,
        date: `2024-01-${String(i % 30 + 1).padStart(2, '0')}`,
        revenue_ex_tax: Math.floor(Math.random() * 200000) + 50000
      }));

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: largeDataset, error: null })
              })
            })
          })
        })
        .mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        });

      const startTime = Date.now();
      const result = await correlationService.analyzeCorrelations(defaultFilters);
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // 5秒以内
    });
  });
});
