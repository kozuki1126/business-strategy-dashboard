/**
 * ExportService ユニットテスト
 */

import ExportService from '@/lib/services/export';
import { createClient } from '@/lib/supabase/server';

// Supabaseクライアントをモック
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

// date-fnsのモック
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatString) => {
    if (formatString === 'yyyyMMdd_HHmmss') {
      return '20250820_120000';
    }
    return date.toISOString().split('T')[0];
  })
}));

describe('ExportService', () => {
  let exportService: ExportService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis()
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    exportService = new ExportService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export sales data successfully', async () => {
      // モックデータ設定
      const mockSalesData = [
        {
          id: '1',
          date: '2025-01-01',
          store_id: 'store-1',
          revenue_ex_tax: 10000,
          footfall: 100,
          store: { name: 'テスト店舗' },
          department: { name: 'テスト部門' },
          category: { name: 'テストカテゴリ' }
        }
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sales') {
          return {
            ...mockSupabase,
            then: (callback: any) => callback({ data: mockSalesData, error: null })
          };
        }
        return mockSupabase;
      });

      const result = await exportService.exportData(
        'sales',
        'csv',
        { startDate: '2025-01-01', endDate: '2025-01-31' }
      );

      expect(result.result.filename).toContain('sales_export_');
      expect(result.result.mimeType).toBe('text/csv; charset=utf-8');
      expect(result.stats.totalRecords).toBe(1);
    });

    it('should export external data successfully', async () => {
      const mockMarketData = [
        {
          date: '2025-01-01',
          symbol: 'TOPIX',
          name: 'TOPIX指数',
          close_price: 2500.0
        }
      ];

      const mockFxData = [
        {
          date: '2025-01-01',
          currency_pair: 'USD/JPY',
          rate: 150.0
        }
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'ext_market_index') {
          return {
            ...mockSupabase,
            then: (callback: any) => callback({ data: mockMarketData, error: null })
          };
        }
        if (table === 'ext_fx_rate') {
          return {
            ...mockSupabase,
            then: (callback: any) => callback({ data: mockFxData, error: null })
          };
        }
        if (table === 'ext_weather_daily') {
          return {
            ...mockSupabase,
            then: (callback: any) => callback({ data: [], error: null })
          };
        }
        return mockSupabase;
      });

      const result = await exportService.exportData(
        'external',
        'excel',
        { startDate: '2025-01-01', endDate: '2025-01-31' }
      );

      expect(result.result.filename).toContain('external_export_');
      expect(result.result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.stats.totalRecords).toBe(2); // market + fx data
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        ...mockSupabase,
        then: (callback: any) => callback({ data: null, error: { message: 'Database error' } })
      }));

      await expect(
        exportService.exportData('sales', 'csv', {})
      ).rejects.toThrow('Export failed: Failed to fetch sales data: Database error');
    });

    it('should validate export filters correctly', async () => {
      const validFilters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        storeId: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = exportService.validateFilters(validFilters);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid date ranges', async () => {
      const invalidFilters = {
        startDate: '2025-01-31',
        endDate: '2025-01-01' // 開始日が終了日より後
      };

      const result = exportService.validateFilters(invalidFilters);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('開始日は終了日より前である必要があります');
    });

    it('should reject period longer than 1 year', async () => {
      const invalidFilters = {
        startDate: '2024-01-01',
        endDate: '2025-02-01' // 1年以上
      };

      const result = exportService.validateFilters(invalidFilters);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('エクスポート期間は最大1年間です');
    });
  });

  describe('validateFileSize', () => {
    it('should accept files under 50MB', () => {
      const size = 40 * 1024 * 1024; // 40MB
      expect(exportService.validateFileSize(size)).toBe(true);
    });

    it('should reject files over 50MB', () => {
      const size = 60 * 1024 * 1024; // 60MB
      expect(exportService.validateFileSize(size)).toBe(false);
    });
  });

  describe('validateFormat', () => {
    it('should accept valid formats', () => {
      expect(exportService.validateFormat('csv')).toBe(true);
      expect(exportService.validateFormat('excel')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(exportService.validateFormat('pdf')).toBe(false);
      expect(exportService.validateFormat('json')).toBe(false);
    });
  });

  describe('CSV generation', () => {
    it('should generate CSV with BOM for Japanese characters', async () => {
      const testData = [
        { name: 'テスト', value: 100 },
        { name: '日本語', value: 200 }
      ];

      // プライベートメソッドにアクセスするため型アサーション
      const result = await (exportService as any).generateCSV(testData, 'test.csv');

      expect(result.filename).toBe('test.csv');
      expect(result.mimeType).toBe('text/csv; charset=utf-8');
      expect(result.buffer.toString('utf8')).toMatch(/^\uFEFF/); // BOMチェック
    });
  });

  describe('Excel generation', () => {
    it('should generate Excel file with proper metadata', async () => {
      const testData = [
        { date: '2025-01-01', revenue: 10000 },
        { date: '2025-01-02', revenue: 15000 }
      ];

      const result = await (exportService as any).generateExcel(testData, 'test.xlsx', 'sales');

      expect(result.filename).toBe('test.xlsx');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      const result = await (exportService as any).generateExcel([], 'empty.xlsx', 'sales');

      expect(result.filename).toBe('empty.xlsx');
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('Data type determination', () => {
    it('should correctly identify sales data', () => {
      const salesItem = { revenue_ex_tax: 10000, footfall: 100 };
      const result = (exportService as any).determineDataType(salesItem);
      expect(result).toBe('sales');
    });

    it('should correctly identify external data', () => {
      const externalItem = { type: 'market_data', value: 2500 };
      const result = (exportService as any).determineDataType(externalItem);
      expect(result).toBe('external');
    });

    it('should default to unknown for unrecognized data', () => {
      const unknownItem = { someField: 'value' };
      const result = (exportService as any).determineDataType(unknownItem);
      expect(result).toBe('unknown');
    });
  });

  describe('Sheet name generation', () => {
    it('should return Japanese sheet names', () => {
      expect((exportService as any).getSheetName('sales')).toBe('売上データ');
      expect((exportService as any).getSheetName('external')).toBe('外部データ');
      expect((exportService as any).getSheetName('market_index')).toBe('市場指標');
      expect((exportService as any).getSheetName('fx_rate')).toBe('為替レート');
      expect((exportService as any).getSheetName('weather')).toBe('天候データ');
      expect((exportService as any).getSheetName('unknown')).toBe('その他');
    });

    it('should fallback to input for unrecognized types', () => {
      expect((exportService as any).getSheetName('custom_type')).toBe('custom_type');
    });
  });

  describe('Error handling', () => {
    it('should handle CSV generation errors', async () => {
      // 循環参照オブジェクトでエラーを発生させる
      const circularData = { a: {} };
      circularData.a = circularData;

      await expect(
        (exportService as any).generateCSV([circularData], 'test.csv')
      ).rejects.toThrow(/CSV generation failed/);
    });

    it('should handle Excel generation errors gracefully', async () => {
      // 大量データでメモリエラーを発生させる可能性のあるテスト
      const largeData = Array(100000).fill({ data: 'x'.repeat(1000) });

      try {
        await (exportService as any).generateExcel(largeData, 'large.xlsx', 'sales');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Excel generation failed/);
      }
    });
  });

  describe('Performance', () => {
    it('should complete small exports within reasonable time', async () => {
      const startTime = Date.now();
      
      const mockData = Array(100).fill({
        id: '1',
        date: '2025-01-01',
        revenue_ex_tax: 10000
      });

      mockSupabase.from.mockImplementation(() => ({
        ...mockSupabase,
        then: (callback: any) => callback({ data: mockData, error: null })
      }));

      await exportService.exportData('sales', 'csv', {});
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5秒以内
    });
  });
});
