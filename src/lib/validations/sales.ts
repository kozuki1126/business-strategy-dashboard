import { z } from 'zod'

// 売上データ入力のバリデーションスキーマ
export const salesInputSchema = z.object({
  date: z.string()
    .min(1, '日付を選択してください')
    .refine((date) => {
      const parsedDate = new Date(date)
      const today = new Date()
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(today.getFullYear() - 1)
      
      return parsedDate >= oneYearAgo && parsedDate <= today
    }, '日付は1年前から今日までの範囲で入力してください'),
    
  store_id: z.string()
    .min(1, '店舗を選択してください')
    .uuid('有効な店舗IDを選択してください'),
    
  department_id: z.string()
    .min(1, '部門を選択してください')
    .uuid('有効な部門IDを選択してください'),
    
  revenue_ex_tax: z.number()
    .min(0, '売上金額は0以上で入力してください')
    .max(100000000, '売上金額は1億円以下で入力してください')
    .multipleOf(0.01, '売上金額は小数点以下2桁まで入力可能です'),
    
  tax_amount: z.number()
    .min(0, '税額は0以上で入力してください')
    .max(10000000, '税額は1000万円以下で入力してください')
    .multipleOf(0.01, '税額は小数点以下2桁まで入力可能です'),
    
  footfall: z.number()
    .int('客数は整数で入力してください')
    .min(0, '客数は0以上で入力してください')
    .max(100000, '客数は10万人以下で入力してください'),
    
  transactions: z.number()
    .int('取引数は整数で入力してください')
    .min(0, '取引数は0以上で入力してください')
    .max(50000, '取引数は5万件以下で入力してください'),
    
  notes: z.string()
    .max(500, '備考は500文字以内で入力してください')
    .optional()
})
.refine((data) => {
  // 税込み売上の妥当性チェック
  const totalRevenue = data.revenue_ex_tax + data.tax_amount
  const minTotalRevenue = Math.max(data.revenue_ex_tax * 1.08, 0) // 最低8%の税率
  const maxTotalRevenue = data.revenue_ex_tax * 1.15 // 最大15%の税率
  
  return totalRevenue >= minTotalRevenue && totalRevenue <= maxTotalRevenue
}, {
  message: '税額が売上金額に対して適切ではありません（税率8-15%の範囲外）',
  path: ['tax_amount']
})
.refine((data) => {
  // 客数と取引数の整合性チェック
  if (data.footfall > 0 && data.transactions > 0) {
    return data.transactions <= data.footfall
  }
  return true
}, {
  message: '取引数は客数以下である必要があります',
  path: ['transactions']
})
.refine((data) => {
  // 客単価の妥当性チェック（極端な値を防ぐ）
  if (data.transactions > 0) {
    const averageOrderValue = data.revenue_ex_tax / data.transactions
    return averageOrderValue >= 50 && averageOrderValue <= 100000
  }
  return true
}, {
  message: '客単価が50円〜10万円の範囲外です。売上または取引数を確認してください',
  path: ['revenue_ex_tax']
})

export type SalesInput = z.infer<typeof salesInputSchema>

// フォーム送信用の型（追加のメタデータを含む）
export const salesSubmissionSchema = salesInputSchema.extend({
  // 自動計算される値
  calculated_aov: z.number().optional(),
  calculated_tax_rate: z.number().optional(),
  
  // 入力者情報（認証ユーザーから自動設定）
  created_by: z.string().optional(),
  
  // バッチ処理用ID（複数レコード一括入力時）
  batch_id: z.string().optional()
})

export type SalesSubmission = z.infer<typeof salesSubmissionSchema>

// 一括入力用のスキーマ
export const bulkSalesInputSchema = z.object({
  sales_records: z.array(salesInputSchema)
    .min(1, '最低1件の売上データを入力してください')
    .max(31, '一度に入力できるのは31件までです'), // 1ヶ月分
    
  batch_notes: z.string()
    .max(1000, 'バッチ備考は1000文字以内で入力してください')
    .optional()
})

export type BulkSalesInput = z.infer<typeof bulkSalesInputSchema>

// 売上データ編集用のスキーマ（IDを含む）
export const salesEditSchema = salesInputSchema.extend({
  id: z.string().uuid('有効な売上IDが必要です'),
  
  // 編集履歴用
  edit_reason: z.string()
    .min(1, '編集理由を入力してください')
    .max(200, '編集理由は200文字以内で入力してください'),
    
  // オリジナルデータの保持用
  original_values: z.record(z.any()).optional()
})

export type SalesEdit = z.infer<typeof salesEditSchema>

// フォームの初期値生成ヘルパー
export function getDefaultSalesInput(): Partial<SalesInput> {
  const today = new Date()
  return {
    date: today.toISOString().split('T')[0], // YYYY-MM-DD format
    revenue_ex_tax: 0,
    tax_amount: 0,
    footfall: 0,
    transactions: 0,
    notes: ''
  }
}

// バリデーションエラーメッセージのカスタマイズ
export const validationMessages = {
  required: '必須項目です',
  invalidDate: '有効な日付を入力してください',
  invalidNumber: '有効な数値を入力してください',
  tooLarge: '値が大きすぎます',
  tooSmall: '値が小さすぎます',
  invalidFormat: '形式が正しくありません'
} as const

// フォームフィールドの設定
export const formFieldConfig = {
  date: {
    label: '売上日',
    placeholder: '売上が発生した日付を選択',
    required: true,
    type: 'date' as const
  },
  store_id: {
    label: '店舗',
    placeholder: '店舗を選択してください',
    required: true,
    type: 'select' as const
  },
  department_id: {
    label: '部門',
    placeholder: '部門を選択してください',
    required: true,
    type: 'select' as const
  },
  revenue_ex_tax: {
    label: '売上金額（税抜）',
    placeholder: '0',
    required: true,
    type: 'number' as const,
    step: 0.01,
    min: 0,
    max: 100000000
  },
  tax_amount: {
    label: '税額',
    placeholder: '0',
    required: true,
    type: 'number' as const,
    step: 0.01,
    min: 0,
    max: 10000000
  },
  footfall: {
    label: '客数',
    placeholder: '0',
    required: true,
    type: 'number' as const,
    step: 1,
    min: 0,
    max: 100000
  },
  transactions: {
    label: '取引数',
    placeholder: '0',
    required: true,
    type: 'number' as const,
    step: 1,
    min: 0,
    max: 50000
  },
  notes: {
    label: '備考',
    placeholder: '特記事項があれば入力してください',
    required: false,
    type: 'textarea' as const,
    maxLength: 500
  }
} as const

// 計算ヘルパー関数
export function calculateMetrics(data: Partial<SalesInput>) {
  const revenue = data.revenue_ex_tax || 0
  const tax = data.tax_amount || 0
  const transactions = data.transactions || 0
  const footfall = data.footfall || 0
  
  return {
    totalRevenue: revenue + tax,
    taxRate: revenue > 0 ? (tax / revenue) * 100 : 0,
    averageOrderValue: transactions > 0 ? revenue / transactions : 0,
    conversionRate: footfall > 0 ? (transactions / footfall) * 100 : 0
  }
}
