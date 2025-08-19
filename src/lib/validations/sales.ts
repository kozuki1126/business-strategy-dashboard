import { SalesInputForm, ValidationError } from '@/types/database.types';

// バリデーションルール定義
export const salesValidationRules = {
  date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: '日付は YYYY-MM-DD 形式で入力してください',
  },
  store_id: {
    required: true,
    message: '店舗を選択してください',
  },
  department: {
    required: true,
    message: '部門を選択してください',
  },
  product_category: {
    required: true,
    message: '商品カテゴリを選択してください',
  },
  revenue_ex_tax: {
    required: true,
    min: 0,
    max: 1000000000, // 10億円上限
    message: '税抜売上は0円以上、10億円以下で入力してください',
  },
  footfall: {
    required: false,
    min: 0,
    max: 100000,
    message: '客数は0人以上、100,000人以下で入力してください',
  },
  transactions: {
    required: false,
    min: 0,
    max: 100000,
    message: '取引数は0件以上、100,000件以下で入力してください',
  },
  discounts: {
    required: false,
    min: 0,
    max: 1000000000,
    message: '割引額は0円以上、10億円以下で入力してください',
  },
  notes: {
    required: false,
    maxLength: 1000,
    message: '備考は1000文字以下で入力してください',
  },
};

// 売上フォームデータバリデーション
export function validateSalesForm(data: Partial<SalesInputForm>): ValidationError[] {
  const errors: ValidationError[] = [];

  // 日付バリデーション
  if (!data.date) {
    errors.push({
      field: 'date',
      message: salesValidationRules.date.message,
      code: 'REQUIRED',
    });
  } else if (!salesValidationRules.date.pattern.test(data.date)) {
    errors.push({
      field: 'date',
      message: salesValidationRules.date.message,
      code: 'INVALID_FORMAT',
    });
  } else {
    // 未来の日付チェック
    const inputDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inputDate > today) {
      errors.push({
        field: 'date',
        message: '未来の日付は入力できません',
        code: 'FUTURE_DATE',
      });
    }
  }

  // 店舗IDバリデーション
  if (!data.store_id) {
    errors.push({
      field: 'store_id',
      message: salesValidationRules.store_id.message,
      code: 'REQUIRED',
    });
  }

  // 部門バリデーション
  if (!data.department) {
    errors.push({
      field: 'department',
      message: salesValidationRules.department.message,
      code: 'REQUIRED',
    });
  }

  // 商品カテゴリバリデーション
  if (!data.product_category) {
    errors.push({
      field: 'product_category',
      message: salesValidationRules.product_category.message,
      code: 'REQUIRED',
    });
  }

  // 税抜売上バリデーション
  if (data.revenue_ex_tax === undefined || data.revenue_ex_tax === null) {
    errors.push({
      field: 'revenue_ex_tax',
      message: '税抜売上は必須です',
      code: 'REQUIRED',
    });
  } else if (data.revenue_ex_tax < 0) {
    errors.push({
      field: 'revenue_ex_tax',
      message: '税抜売上は0円以上で入力してください',
      code: 'MIN_VALUE',
    });
  } else if (data.revenue_ex_tax > salesValidationRules.revenue_ex_tax.max) {
    errors.push({
      field: 'revenue_ex_tax',
      message: salesValidationRules.revenue_ex_tax.message,
      code: 'MAX_VALUE',
    });
  }

  // 客数バリデーション（オプション）
  if (data.footfall !== undefined && data.footfall !== null) {
    if (data.footfall < 0) {
      errors.push({
        field: 'footfall',
        message: '客数は0人以上で入力してください',
        code: 'MIN_VALUE',
      });
    } else if (data.footfall > salesValidationRules.footfall.max!) {
      errors.push({
        field: 'footfall',
        message: salesValidationRules.footfall.message,
        code: 'MAX_VALUE',
      });
    }
  }

  // 取引数バリデーション（オプション）
  if (data.transactions !== undefined && data.transactions !== null) {
    if (data.transactions < 0) {
      errors.push({
        field: 'transactions',
        message: '取引数は0件以上で入力してください',
        code: 'MIN_VALUE',
      });
    } else if (data.transactions > salesValidationRules.transactions.max!) {
      errors.push({
        field: 'transactions',
        message: salesValidationRules.transactions.message,
        code: 'MAX_VALUE',
      });
    }

    // 客数との整合性チェック
    if (data.footfall && data.transactions > data.footfall) {
      errors.push({
        field: 'transactions',
        message: '取引数は客数以下である必要があります',
        code: 'INCONSISTENT_DATA',
      });
    }
  }

  // 割引額バリデーション（オプション）
  if (data.discounts !== undefined && data.discounts !== null) {
    if (data.discounts < 0) {
      errors.push({
        field: 'discounts',
        message: '割引額は0円以上で入力してください',
        code: 'MIN_VALUE',
      });
    } else if (data.discounts > salesValidationRules.discounts.max!) {
      errors.push({
        field: 'discounts',
        message: salesValidationRules.discounts.message,
        code: 'MAX_VALUE',
      });
    }

    // 売上との整合性チェック
    if (data.revenue_ex_tax && data.discounts > data.revenue_ex_tax) {
      errors.push({
        field: 'discounts',
        message: '割引額は税抜売上以下である必要があります',
        code: 'INCONSISTENT_DATA',
      });
    }
  }

  // 備考バリデーション（オプション）
  if (data.notes && data.notes.length > salesValidationRules.notes.maxLength!) {
    errors.push({
      field: 'notes',
      message: salesValidationRules.notes.message,
      code: 'MAX_LENGTH',
    });
  }

  return errors;
}

// 単一フィールドバリデーション
export function validateField(field: keyof SalesInputForm, value: any): ValidationError | null {
  const errors = validateSalesForm({ [field]: value } as Partial<SalesInputForm>);
  return errors.find(error => error.field === field) || null;
}

// 日付フォーマットヘルパー
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 今日の日付を取得
export function getTodayString(): string {
  return formatDate(new Date());
}

// 数値フォーマットヘルパー
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

// 数値パースヘルパー
export function parseCurrency(value: string): number {
  // カンマ区切りや円マークを除去して数値に変換
  const cleanValue = value.replace(/[,円￥]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}