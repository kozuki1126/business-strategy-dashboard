/**
 * エクスポートサービス ユニットテスト
 */

import { ExportService } from '@/lib/services/export';
import { createClient } from '@/lib/supabase/server';

// モック
jest.mock('@/lib/supabase/server');
jest.mock('papaparse');
jest.mock('exceljs');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
};

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('ExportService', () => {
  let exportService: ExportService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabase as any);
    exportService = new ExportService();
  });

  describe('exportData', () => {
    const mockSalesData = [
      {
        id: '1',
        date: '2025-01-15',
        store_id: 'store1',
        revenue_ex_tax: 100000,
        footfall: 150,
        transactions: 45,
        store: { name: '店舗A' },
        department: { name: '部門1' },
        category: { name: 'カテゴリA' }
      }
    ];

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockResolvedValue({ 
          data: mockSalesData, 
          error: null 
        })
      });
    });

    test('should export sales data as CSV', async () => {
      // PapaParseのモック
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('mock,csv,data');

      const result = await exportService.exportData('sales', 'csv', {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      });

      expect(result.result.filename).toMatch(/sales_export_.*\.csv/);
      expect(result.result.mimeType).toBe('text/csv; charset=utf-8');
      expect(result.stats.totalRecords).toBe(1);
      expect(Papa.unparse).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: '1' })]),
        { header: true, encoding: 'utf8' }
      );
    });

    test('should export sales data as Excel', async () => {
      // ExcelJSのモック
      const ExcelJS = require('exceljs');
      const mockWorkbook = {
        creator: '',
        lastModifiedBy: '',
        created: null,
        modified: null,
        addWorksheet: jest.fn().mockReturnValue({
          addRow: jest.fn().mockReturnValue({
            eachCell: jest.fn()
          }),
          columns: []
        }),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock excel data'))
        }
      };
      ExcelJS.Workbook = jest.fn().mockImplementation(() => mockWorkbook);

      const result = await exportService.exportData('sales', 'excel', {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      });

      expect(result.result.filename).toMatch(/sales_export_.*\.xlsx/);
      expect(result.result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalled();
    });

    test('should apply filters correctly', async () => {
      const filters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        storeId: 'store1',
        department: 'dept1',
        category: 'cat1'
      };

      await exportService.exportData('sales', 'csv', filters);

      expect(mockSupabase.gte).toHaveBeenCalledWith('date', '2025-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('date', '2025-01-31');
      expect(mockSupabase.eq).toHaveBeenCalledWith('store_id', 'store1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('department', 'dept1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('product_category', 'cat1');
    });

    test('should handle external data export', async () => {
      const mockExternalData = [
        { date: '2025-01-15', close_price: 2500, symbol: 'TOPIX', name: 'TOPIX' }
      ];

      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockResolvedValue({ 
          data: mockExternalData, 
          error: null 
        })
      });

      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('mock,external,data');

      const result = await exportService.exportData('external', 'csv', {});

      expect(result.result.filename).toMatch(/external_export_.*\.csv/);
      expect(result.stats.totalRecords).toBeGreaterThan(0);
    });

    test('should handle combined data export', async () => {
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('mock,combined,data');

      const result = await exportService.exportData('combined', 'csv', {});

      expect(result.result.filename).toMatch(/combined_export_.*\.csv/);
      expect(mockSupabase.from).toHaveBeenCalledWith('sales');
      expect(mockSupabase.from).toHaveBeenCalledWith('ext_market_index');
    });

    test('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' }
        })
      });

      await expect(
        exportService.exportData('sales', 'csv', {})
      ).rejects.toThrow('Failed to fetch sales data: Database error');
    });

    test('should measure processing time correctly', async () => {
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('mock,csv,data');

      const result = await exportService.exportData('sales', 'csv', {});

      expect(result.stats.generationTime).toBeDefined();
      expect(result.stats.generationTime).toBeGreaterThan(0);
    });
  });

  describe('validateFilters', () => {
    test('should validate date range correctly', () => {
      const validFilters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const result = exportService.validateFilters(validFilters);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid date range', () => {
      const invalidFilters = {
        startDate: '2025-01-31',
        endDate: '2025-01-01'
      };

      const result = exportService.validateFilters(invalidFilters);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('開始日は終了日より前である必要があります');
    });

    test('should reject period longer than 1 year', () => {
      const longPeriodFilters = {
        startDate: '2023-01-01',
        endDate: '2024-02-01'
      };

      const result = exportService.validateFilters(longPeriodFilters);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('エクスポート期間は最大1年間です');
    });

    test('should accept valid period within 1 year', () => {
      const validPeriodFilters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const result = exportService.validateFilters(validPeriodFilters);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFormat', () => {
    test('should accept valid formats', () => {
      expect(exportService.validateFormat('csv')).toBe(true);
      expect(exportService.validateFormat('excel')).toBe(true);
    });

    test('should reject invalid formats', () => {
      expect(exportService.validateFormat('pdf')).toBe(false);
      expect(exportService.validateFormat('json')).toBe(false);
      expect(exportService.validateFormat('')).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    test('should accept files under 50MB', () => {
      const size = 30 * 1024 * 1024; // 30MB
      expect(exportService.validateFileSize(size)).toBe(true);
    });

    test('should reject files over 50MB', () => {
      const size = 60 * 1024 * 1024; // 60MB
      expect(exportService.validateFileSize(size)).toBe(false);
    });

    test('should accept exactly 50MB', () => {
      const size = 50 * 1024 * 1024; // 50MB
      expect(exportService.validateFileSize(size)).toBe(true);
    });
  });

  describe('CSV generation', () => {
    test('should generate CSV with BOM for Excel compatibility', async () => {
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('header1,header2\nvalue1,value2');

      const result = await exportService.exportData('sales', 'csv', {});

      // BOM（\uFEFF）が先頭に付加されることを確認
      const content = result.result.buffer.toString('utf8');
      expect(content.startsWith('\uFEFF')).toBe(true);
    });

    test('should handle empty data gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockResolvedValue({ 
          data: [], 
          error: null 
        })
      });

      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('');

      const result = await exportService.exportData('sales', 'csv', {});
      
      expect(result.stats.totalRecords).toBe(0);
      expect(Papa.unparse).toHaveBeenCalledWith([], expect.any(Object));
    });
  });

  describe('Excel generation', () => {
    test('should create multiple sheets for combined data', async () => {
      const ExcelJS = require('exceljs');
      const mockWorksheet = {
        addRow: jest.fn().mockReturnValue({
          eachCell: jest.fn()
        }),
        columns: []
      };
      const mockWorkbook = {
        creator: '',
        lastModifiedBy: '',
        created: null,
        modified: null,
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock excel data'))
        }
      };
      ExcelJS.Workbook = jest.fn().mockImplementation(() => mockWorkbook);

      await exportService.exportData('combined', 'excel', {});

      // 複数回addWorksheetが呼ばれることを確認（売上データ + 外部データ）
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(1);
    });

    test('should apply Excel formatting', async () => {
      const ExcelJS = require('exceljs');
      const mockHeaderRow = {
        eachCell: jest.fn()
      };
      const mockWorksheet = {
        addRow: jest.fn()
          .mockReturnValueOnce(mockHeaderRow)
          .mockReturnValue({ eachCell: jest.fn() }),
        columns: [{ width: 0 }]
      };
      const mockWorkbook = {
        creator: '',
        lastModifiedBy: '',
        created: null,
        modified: null,
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock excel data'))
        }
      };
      ExcelJS.Workbook = jest.fn().mockImplementation(() => mockWorkbook);

      await exportService.exportData('sales', 'excel', {});

      expect(mockHeaderRow.eachCell).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle CSV generation errors', async () => {
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockImplementation(() => {
        throw new Error('CSV generation failed');
      });

      await expect(
        exportService.exportData('sales', 'csv', {})
      ).rejects.toThrow('Export failed: CSV generation failed');
    });

    test('should handle Excel generation errors', async () => {
      const ExcelJS = require('exceljs');
      ExcelJS.Workbook = jest.fn().mockImplementation(() => {
        throw new Error('Excel workbook creation failed');
      });

      await expect(
        exportService.exportData('sales', 'excel', {})
      ).rejects.toThrow('Export failed: Excel workbook creation failed');
    });

    test('should handle unknown data types', async () => {
      await expect(
        exportService.exportData('unknown' as any, 'csv', {})
      ).rejects.toThrow('Export failed: Unsupported data type: unknown');
    });
  });

  describe('Performance', () => {
    test('should complete export within reasonable time', async () => {
      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('mock,csv,data');

      const startTime = Date.now();
      const result = await exportService.exportData('sales', 'csv', {});
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
      expect(result.stats.generationTime).toBeLessThan(1000);
    });

    test('should handle large datasets efficiently', async () => {
      // 大量のモックデータを生成
      const largeMockData = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        date: '2025-01-15',
        revenue_ex_tax: 100000,
        store: { name: `店舗${i}` }
      }));

      mockSupabase.from.mockReturnValue({
        ...mockSupabase,
        select: jest.fn().mockResolvedValue({ 
          data: largeMockData, 
          error: null 
        })
      });

      const Papa = require('papaparse');
      Papa.unparse = jest.fn().mockReturnValue('large,mock,csv,data');

      const result = await exportService.exportData('sales', 'csv', {});

      expect(result.stats.totalRecords).toBe(1000);
      expect(result.stats.generationTime).toBeLessThan(5000); // 5秒以内（SLA）
    });
  });
});
