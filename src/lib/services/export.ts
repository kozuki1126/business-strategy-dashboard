/**
 * エクスポートサービス
 * CSV/Excelファイル生成とダウンロード機能を提供
 */

import * as Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database.types';

// エクスポート形式
export type ExportFormat = 'csv' | 'excel';

// エクスポートフィルター
export interface ExportFilters {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  department?: string;
  category?: string;
}

// エクスポートデータタイプ
export type ExportDataType = 'sales' | 'external' | 'combined';

// エクスポート結果
export interface ExportResult {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

// エクスポート統計
export interface ExportStats {
  totalRecords: number;
  filteredRecords: number;
  generationTime: number;
  fileSize: number;
}

type SalesData = Database['public']['Tables']['sales']['Row'] & {
  store_name?: string;
  department_name?: string;
  category_name?: string;
};

type ExternalData = {
  date: string;
  type: string;
  value: number;
  description: string;
  source: string;
};

export class ExportService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * データエクスポート実行
   */
  async exportData(
    dataType: ExportDataType,
    format: ExportFormat,
    filters: ExportFilters
  ): Promise<{ result: ExportResult; stats: ExportStats }> {
    const startTime = Date.now();

    try {
      // データ取得
      const data = await this.fetchData(dataType, filters);
      
      // ファイル生成
      const result = await this.generateFile(data, format, dataType);
      
      // 統計情報
      const stats: ExportStats = {
        totalRecords: data.length,
        filteredRecords: data.length,
        generationTime: Date.now() - startTime,
        fileSize: result.size
      };

      return { result, stats };
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * データ取得
   */
  private async fetchData(dataType: ExportDataType, filters: ExportFilters): Promise<any[]> {
    switch (dataType) {
      case 'sales':
        return this.fetchSalesData(filters);
      case 'external':
        return this.fetchExternalData(filters);
      case 'combined':
        const [sales, external] = await Promise.all([
          this.fetchSalesData(filters),
          this.fetchExternalData(filters)
        ]);
        return [...sales, ...external];
      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  /**
   * 売上データ取得
   */
  private async fetchSalesData(filters: ExportFilters): Promise<SalesData[]> {
    let query = this.supabase
      .from('sales')
      .select(`
        *,
        store:dim_store(name),
        department:dim_department(name),
        category:dim_product_category(name)
      `);

    // フィルター適用
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters.department) {
      query = query.eq('department', filters.department);
    }
    if (filters.category) {
      query = query.eq('product_category', filters.category);
    }

    query = query.order('date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sales data: ${error.message}`);
    }

    // データ変換
    return (data || []).map(item => ({
      ...item,
      store_name: item.store?.name || '',
      department_name: item.department?.name || '',
      category_name: item.category?.name || ''
    }));
  }

  /**
   * 外部データ取得
   */
  private async fetchExternalData(filters: ExportFilters): Promise<ExternalData[]> {
    const results: ExternalData[] = [];

    // 市場データ
    const { data: marketData } = await this.supabase
      .from('ext_market_index')
      .select('*')
      .gte('date', filters.startDate || '2024-01-01')
      .lte('date', filters.endDate || '2025-12-31')
      .order('date', { ascending: false });

    if (marketData) {
      results.push(...marketData.map(item => ({
        date: item.date,
        type: 'market_index',
        value: item.close_price,
        description: `${item.symbol} - ${item.name}`,
        source: 'market_data'
      })));
    }

    // 為替データ
    const { data: fxData } = await this.supabase
      .from('ext_fx_rate')
      .select('*')
      .gte('date', filters.startDate || '2024-01-01')
      .lte('date', filters.endDate || '2025-12-31')
      .order('date', { ascending: false });

    if (fxData) {
      results.push(...fxData.map(item => ({
        date: item.date,
        type: 'fx_rate',
        value: item.rate,
        description: `${item.currency_pair}`,
        source: 'fx_data'
      })));
    }

    // 天候データ
    const { data: weatherData } = await this.supabase
      .from('ext_weather_daily')
      .select('*')
      .gte('date', filters.startDate || '2024-01-01')
      .lte('date', filters.endDate || '2025-12-31')
      .order('date', { ascending: false });

    if (weatherData) {
      results.push(...weatherData.map(item => ({
        date: item.date,
        type: 'weather',
        value: item.temp_avg,
        description: `${item.location} - ${item.condition}`,
        source: 'weather_data'
      })));
    }

    return results;
  }

  /**
   * ファイル生成
   */
  private async generateFile(
    data: any[],
    format: ExportFormat,
    dataType: ExportDataType
  ): Promise<ExportResult> {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `${dataType}_export_${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;

    if (format === 'csv') {
      return this.generateCSV(data, filename);
    } else {
      return this.generateExcel(data, filename, dataType);
    }
  }

  /**
   * CSV生成
   */
  private async generateCSV(data: any[], filename: string): Promise<ExportResult> {
    try {
      const csv = Papa.unparse(data, {
        header: true,
        encoding: 'utf8'
      });

      const buffer = Buffer.from('\uFEFF' + csv, 'utf8'); // BOM付き UTF-8

      return {
        filename,
        buffer,
        mimeType: 'text/csv; charset=utf-8',
        size: buffer.length
      };
    } catch (error) {
      throw new Error(`CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Excel生成
   */
  private async generateExcel(data: any[], filename: string, dataType: ExportDataType): Promise<ExportResult> {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // メタデータ設定
      workbook.creator = 'Business Strategy Dashboard';
      workbook.lastModifiedBy = 'System';
      workbook.created = new Date();
      workbook.modified = new Date();

      if (dataType === 'combined') {
        // 複合データの場合は複数シートに分割
        await this.createMultipleSheets(workbook, data);
      } else {
        // 単一データの場合は1シート
        await this.createSingleSheet(workbook, data, dataType);
      }

      const buffer = await workbook.xlsx.writeBuffer();

      return {
        filename,
        buffer: Buffer.from(buffer),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.byteLength
      };
    } catch (error) {
      throw new Error(`Excel generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 単一シート作成
   */
  private async createSingleSheet(workbook: ExcelJS.Workbook, data: any[], dataType: string) {
    const worksheet = workbook.addWorksheet(this.getSheetName(dataType));
    
    if (data.length === 0) {
      worksheet.addRow(['No data available']);
      return;
    }

    // ヘッダー設定
    const headers = Object.keys(data[0]);
    const headerRow = worksheet.addRow(headers);
    
    // ヘッダースタイル
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // データ行追加
    data.forEach(row => {
      const values = headers.map(header => row[header] || '');
      worksheet.addRow(values);
    });

    // 列幅自動調整
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
  }

  /**
   * 複数シート作成
   */
  private async createMultipleSheets(workbook: ExcelJS.Workbook, data: any[]) {
    // データタイプ別に分類
    const groupedData = data.reduce((acc, item) => {
      const type = this.determineDataType(item);
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // 各タイプ別にシート作成
    for (const [type, typeData] of Object.entries(groupedData)) {
      await this.createSingleSheet(workbook, typeData, type);
    }
  }

  /**
   * データタイプ判定
   */
  private determineDataType(item: any): string {
    if (item.revenue_ex_tax !== undefined) return 'sales';
    if (item.type !== undefined) return 'external';
    return 'unknown';
  }

  /**
   * シート名取得
   */
  private getSheetName(dataType: string): string {
    const names = {
      sales: '売上データ',
      external: '外部データ',
      market_index: '市場指標',
      fx_rate: '為替レート',
      weather: '天候データ',
      unknown: 'その他'
    };
    return names[dataType as keyof typeof names] || dataType;
  }

  /**
   * ファイルサイズ制限チェック
   */
  validateFileSize(size: number): boolean {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    return size <= MAX_FILE_SIZE;
  }

  /**
   * エクスポート形式検証
   */
  validateFormat(format: string): format is ExportFormat {
    return ['csv', 'excel'].includes(format);
  }

  /**
   * フィルター検証
   */
  validateFilters(filters: ExportFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      
      if (start > end) {
        errors.push('開始日は終了日より前である必要があります');
      }

      // 期間制限（最大1年）
      const maxPeriod = 365 * 24 * 60 * 60 * 1000; // 1年
      if (end.getTime() - start.getTime() > maxPeriod) {
        errors.push('エクスポート期間は最大1年間です');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default ExportService;
