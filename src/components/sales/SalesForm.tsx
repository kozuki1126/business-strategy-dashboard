'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { 
  validateSalesForm, 
  getTodayString, 
  formatCurrency, 
  parseCurrency 
} from '@/lib/validations/sales';
import { 
  SalesInputForm, 
  ValidationError, 
  APIResponse 
} from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';

interface SalesFormProps {
  onSuccess?: () => void;
  initialData?: Partial<SalesInputForm>;
}

// 部門オプション（実際の運用では API から取得）
const DEPARTMENTS = [
  { value: 'electronics', label: '家電' },
  { value: 'clothing', label: '衣料品' },
  { value: 'food', label: '食品' },
  { value: 'cosmetics', label: '化粧品' },
  { value: 'books', label: '書籍' },
  { value: 'sports', label: 'スポーツ用品' },
];

// 商品カテゴリオプション
const PRODUCT_CATEGORIES = [
  { value: 'premium', label: 'プレミアム' },
  { value: 'standard', label: 'スタンダード' },
  { value: 'budget', label: 'バジェット' },
  { value: 'seasonal', label: 'シーズン商品' },
  { value: 'limited', label: '限定商品' },
];

export function SalesForm({ onSuccess, initialData }: SalesFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // フォーム状態
  const [formData, setFormData] = useState<SalesInputForm>({
    date: getTodayString(),
    store_id: '',
    department: '',
    product_category: '',
    revenue_ex_tax: 0,
    footfall: undefined,
    transactions: undefined,
    discounts: undefined,
    notes: '',
    ...initialData,
  });

  // UI状態
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stores, setStores] = useState<{ value: string; label: string }[]>([]);
  const [showCalculations, setShowCalculations] = useState(false);

  // 店舗データを取得
  useEffect(() => {
    async function fetchStores() {
      try {
        const { data, error } = await supabase
          .from('dim_store')
          .select('id, name, area')
          .order('name');

        if (error) throw error;

        const storeOptions = data.map(store => ({
          value: store.id,
          label: `${store.name}${store.area ? ` (${store.area})` : ''}`,
        }));
        setStores(storeOptions);
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      }
    }

    fetchStores();
  }, [supabase]);

  // フォーム入力ハンドラー
  const handleInputChange = (field: keyof SalesInputForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // リアルタイムバリデーション
    const fieldErrors = validateSalesForm({ [field]: value });
    const fieldError = fieldErrors.find(err => err.field === field);
    
    setErrors(prev => ({
      ...prev,
      [field]: fieldError ? fieldError.message : '',
    }));
  };

  // 数値入力ハンドラー
  const handleNumberChange = (field: keyof SalesInputForm, value: string) => {
    const numericValue = value === '' ? undefined : parseCurrency(value);
    handleInputChange(field, numericValue as number);
  };

  // 計算値の取得
  const getCalculations = () => {
    const { revenue_ex_tax, footfall, transactions, discounts } = formData;
    
    const calculations = {
      totalRevenue: revenue_ex_tax + (revenue_ex_tax * 0.1), // 税込売上（10%）
      averageTransactionValue: transactions && transactions > 0 
        ? revenue_ex_tax / transactions 
        : 0,
      conversionRate: footfall && footfall > 0 && transactions 
        ? (transactions / footfall) * 100 
        : 0,
      effectiveRevenue: revenue_ex_tax - (discounts || 0),
    };

    return calculations;
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    const validationErrors = validateSalesForm(formData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // 売上データを API に送信
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result: APIResponse<any> = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save sales data');
      }

      // 成功時の処理
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard?refresh=true');
      }

      // フォームリセット
      setFormData({
        date: getTodayString(),
        store_id: formData.store_id, // 店舗は維持
        department: '',
        product_category: '',
        revenue_ex_tax: 0,
        footfall: undefined,
        transactions: undefined,
        discounts: undefined,
        notes: '',
      });

    } catch (error) {
      console.error('Error saving sales data:', error);
      setErrors({
        submit: error instanceof Error ? error.message : '保存に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculations = getCalculations();

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">売上入力</h2>
        <p className="text-gray-600">店舗の売上データを入力してください。税抜金額で入力してください。</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            type="date"
            label="日付 *"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            error={errors.date}
            max={getTodayString()}
            required
          />

          <Select
            label="店舗 *"
            options={stores}
            value={formData.store_id}
            onChange={(e) => handleInputChange('store_id', e.target.value)}
            error={errors.store_id}
            placeholder="店舗を選択"
            required
          />

          <Select
            label="部門 *"
            options={DEPARTMENTS}
            value={formData.department}
            onChange={(e) => handleInputChange('department', e.target.value)}
            error={errors.department}
            placeholder="部門を選択"
            required
          />

          <Select
            label="商品カテゴリ *"
            options={PRODUCT_CATEGORIES}
            value={formData.product_category}
            onChange={(e) => handleInputChange('product_category', e.target.value)}
            error={errors.product_category}
            placeholder="カテゴリを選択"
            required
          />
        </div>

        {/* 売上情報 */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">売上情報</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              type="number"
              label="税抜売上 * (円)"
              value={formData.revenue_ex_tax?.toString() || ''}
              onChange={(e) => handleNumberChange('revenue_ex_tax', e.target.value)}
              error={errors.revenue_ex_tax}
              min="0"
              step="1"
              placeholder="0"
              required
            />

            <Input
              type="number"
              label="客数 (人)"
              value={formData.footfall?.toString() || ''}
              onChange={(e) => handleNumberChange('footfall', e.target.value)}
              error={errors.footfall}
              min="0"
              step="1"
              placeholder="任意"
            />

            <Input
              type="number"
              label="取引数 (件)"
              value={formData.transactions?.toString() || ''}
              onChange={(e) => handleNumberChange('transactions', e.target.value)}
              error={errors.transactions}
              min="0"
              step="1"
              placeholder="任意"
            />

            <Input
              type="number"
              label="割引額 (円)"
              value={formData.discounts?.toString() || ''}
              onChange={(e) => handleNumberChange('discounts', e.target.value)}
              error={errors.discounts}
              min="0"
              step="1"
              placeholder="任意"
            />
          </div>
        </div>

        {/* 計算結果表示 */}
        {formData.revenue_ex_tax > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">計算結果</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCalculations(!showCalculations)}
              >
                {showCalculations ? '非表示' : '表示'}
              </Button>
            </div>
            
            {showCalculations && (
              <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">税込売上</p>
                  <p className="font-semibold">{formatCurrency(calculations.totalRevenue)}</p>
                </div>
                {calculations.averageTransactionValue > 0 && (
                  <div>
                    <p className="text-gray-600">客単価</p>
                    <p className="font-semibold">{formatCurrency(calculations.averageTransactionValue)}</p>
                  </div>
                )}
                {calculations.conversionRate > 0 && (
                  <div>
                    <p className="text-gray-600">転換率</p>
                    <p className="font-semibold">{calculations.conversionRate.toFixed(1)}%</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-600">実質売上</p>
                  <p className="font-semibold">{formatCurrency(calculations.effectiveRevenue)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 備考 */}
        <div className="border-t pt-6">
          <Input
            type="text"
            label="備考"
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            error={errors.notes}
            placeholder="特記事項があれば入力"
            hint="最大1000文字"
          />
        </div>

        {/* エラー表示 */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{errors.submit}</p>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : '売上を保存'}
          </Button>
        </div>
      </form>
    </div>
  );
}