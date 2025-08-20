/**
 * エクスポート機能のバリデーションスキーマ
 */

import { z } from 'zod';

// エクスポート形式
export const ExportFormatSchema = z.enum(['csv', 'excel'], {
  errorMap: () => ({ message: 'CSV または Excel を選択してください' })
});

// エクスポートデータタイプ
export const ExportDataTypeSchema = z.enum(['sales', 'external', 'combined'], {
  errorMap: () => ({ message: '売上データ、外部データ、または統合データを選択してください' })
});

// 日付バリデーション
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
  .refine(
    (dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
    },
    '有効な日付を入力してください'
  );

// エクスポートフィルター
export const ExportFiltersSchema = z
  .object({
    startDate: DateSchema.optional(),
    endDate: DateSchema.optional(),
    storeId: z.string().uuid('有効な店舗IDを選択してください').optional(),
    department: z.string().min(1, '部門を選択してください').optional(),
    category: z.string().min(1, 'カテゴリを選択してください').optional()
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: '開始日は終了日以前である必要があります',
      path: ['endDate']
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays <= 365; // 最大1年
      }
      return true;
    },
    {
      message: 'エクスポート期間は最大1年間です',
      path: ['endDate']
    }
  )
  .refine(
    (data) => {
      // 未来日付チェック
      const today = new Date();
      today.setHours(23, 59, 59, 999); // 当日の最後まで許可
      
      if (data.startDate) {
        const start = new Date(data.startDate);
        if (start > today) {
          return false;
        }
      }
      
      if (data.endDate) {
        const end = new Date(data.endDate);
        if (end > today) {
          return false;
        }
      }
      
      return true;
    },
    {
      message: '未来の日付は指定できません',
      path: ['startDate']
    }
  );

// エクスポートリクエスト
export const ExportRequestSchema = z.object({
  dataType: ExportDataTypeSchema,
  format: ExportFormatSchema,
  filters: ExportFiltersSchema.optional()
});

// フォーム用のエクスポートフィルター（緩い検証）
export const ExportFormFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  storeId: z.string().optional(),
  department: z.string().optional(),
  category: z.string().optional()
});

// エクスポート設定
export const ExportConfigSchema = z.object({
  dataType: ExportDataTypeSchema,
  format: ExportFormatSchema,
  filters: ExportFormFiltersSchema,
  includeHeaders: z.boolean().default(true),
  customFilename: z
    .string()
    .regex(/^[a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/, 
           'ファイル名に使用できない文字が含まれています')
    .max(50, 'ファイル名は50文字以内で入力してください')
    .optional()
});

// 型定義
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ExportDataType = z.infer<typeof ExportDataTypeSchema>;
export type ExportFilters = z.infer<typeof ExportFiltersSchema>;
export type ExportFormFilters = z.infer<typeof ExportFormFiltersSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportConfig = z.infer<typeof ExportConfigSchema>;

// バリデーション関数
export function validateExportRequest(data: unknown): {
  success: boolean;
  data?: ExportRequest;
  errors?: string[];
} {
  try {
    const result = ExportRequestSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['不明な検証エラーが発生しました']
    };
  }
}

export function validateExportFilters(data: unknown): {
  success: boolean;
  data?: ExportFilters;
  errors?: string[];
} {
  try {
    const result = ExportFiltersSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['不明な検証エラーが発生しました']
    };
  }
}

// デフォルト値
export const DEFAULT_EXPORT_CONFIG: Partial<ExportConfig> = {
  format: 'csv',
  dataType: 'sales',
  includeHeaders: true,
  filters: {}
};

// フォーマット表示名
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel'
};

// データタイプ表示名
export const EXPORT_DATA_TYPE_LABELS: Record<ExportDataType, string> = {
  sales: '売上データ',
  external: '外部データ',
  combined: '統合データ'
};

// エクスポート制限
export const EXPORT_LIMITS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxRecords: 100000, // 10万件
  maxPeriodDays: 365, // 1年
  rateLimitPerHour: 5 // 5回/時間
} as const;
