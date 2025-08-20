/**
 * エクスポートフォームコンポーネント
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Download, FileText, FileSpreadsheet, Calendar, Building2, Users, Filter, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { 
  ExportConfigSchema, 
  ExportConfig, 
  EXPORT_FORMAT_LABELS, 
  EXPORT_DATA_TYPE_LABELS,
  EXPORT_LIMITS,
  DEFAULT_EXPORT_CONFIG
} from '@/lib/validations/export';

interface ExportFormProps {
  stores?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  onExport?: (config: ExportConfig) => Promise<void>;
  className?: string;
}

interface ExportStatus {
  isExporting: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

interface RateLimitInfo {
  remainingRequests: number;
  maxRequests: number;
  resetTime: number;
}

export default function ExportForm({ 
  stores = [], 
  departments = [], 
  categories = [], 
  onExport, 
  className = '' 
}: ExportFormProps) {
  const [status, setStatus] = useState<ExportStatus>({ isExporting: false });
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ExportConfig>({
    resolver: zodResolver(ExportConfigSchema),
    defaultValues: DEFAULT_EXPORT_CONFIG
  });

  const watchedValues = watch();

  // レート制限情報取得
  useEffect(() => {
    fetchRateLimitInfo();
  }, []);

  const fetchRateLimitInfo = async () => {
    try {
      const response = await fetch('/api/export');
      if (response.ok) {
        const data = await response.json();
        setRateLimitInfo(data.rateLimit);
      }
    } catch (error) {
      console.error('Failed to fetch rate limit info:', error);
    }
  };

  // プリセット期間設定
  const setPresetPeriod = (preset: string) => {
    const today = new Date();
    let startDate: Date;
    let endDate = today;

    switch (preset) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = subDays(today, 7);
        break;
      case 'month':
        startDate = subDays(today, 30);
        break;
      case 'thisMonth':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'quarter':
        startDate = subDays(today, 90);
        break;
      default:
        return;
    }

    setValue('filters.startDate', format(startDate, 'yyyy-MM-dd'));
    setValue('filters.endDate', format(endDate, 'yyyy-MM-dd'));
  };

  // データプレビュー
  const handlePreview = async () => {
    // プレビュー機能は簡易実装
    const { dataType, filters } = watchedValues;
    
    try {
      setStatus({ isExporting: true, message: 'プレビューデータ取得中...' });
      
      // プレビュー用API呼び出し（実際の実装では別エンドポイント）
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataType,
          filters: {
            ...filters,
            limit: 10 // プレビューは最大10件
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setStatus({ isExporting: false, message: 'プレビューデータを取得しました' });
      } else {
        throw new Error('プレビューデータの取得に失敗しました');
      }
    } catch (error) {
      setStatus({ 
        isExporting: false, 
        error: error instanceof Error ? error.message : 'プレビューエラー'
      });
    }
  };

  // エクスポート実行
  const handleExport = async (data: ExportConfig) => {
    if (rateLimitInfo && rateLimitInfo.remainingRequests <= 0) {
      setStatus({ 
        isExporting: false, 
        error: `エクスポート制限に達しています。${new Date(rateLimitInfo.resetTime).toLocaleTimeString()}にリセットされます。`
      });
      return;
    }

    try {
      setStatus({ isExporting: true, message: 'エクスポート処理中...' });

      if (onExport) {
        await onExport(data);
        setStatus({ isExporting: false, message: 'エクスポートが完了しました' });
        // レート制限情報更新
        await fetchRateLimitInfo();
      } else {
        // デフォルトエクスポート処理
        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          // ファイルダウンロード
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export.csv';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          setStatus({ isExporting: false, message: 'エクスポートが完了しました' });
          await fetchRateLimitInfo();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'エクスポートに失敗しました');
        }
      }
    } catch (error) {
      setStatus({ 
        isExporting: false, 
        error: error instanceof Error ? error.message : 'エクスポートエラー'
      });
    }
  };

  // リセット
  const handleReset = () => {
    reset(DEFAULT_EXPORT_CONFIG);
    setPreviewData(null);
    setStatus({ isExporting: false });
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">データエクスポート</h2>
      </div>

      <form onSubmit={handleSubmit(handleExport)} className="space-y-6">
        {/* データタイプ選択 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            エクスポートデータ
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(EXPORT_DATA_TYPE_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value={value}
                  {...register('dataType')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-gray-500">
                    {value === 'sales' && '売上・客数・取引データ'}
                    {value === 'external' && '市場・為替・天候データ'}
                    {value === 'combined' && '全データを統合'}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.dataType && (
            <p className="text-sm text-red-600">{errors.dataType.message}</p>
          )}
        </div>

        {/* フォーマット選択 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            ファイル形式
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(EXPORT_FORMAT_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value={value}
                  {...register('format')}
                  className="mr-3"
                />
                {value === 'csv' ? (
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-blue-600" />
                )}
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-gray-500">
                    {value === 'csv' && 'カンマ区切り値ファイル'}
                    {value === 'excel' && 'Microsoft Excel形式'}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.format && (
            <p className="text-sm text-red-600">{errors.format.message}</p>
          )}
        </div>

        {/* フィルター設定 */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">フィルター設定</h3>
          </div>

          {/* 期間設定 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              期間設定
            </label>
            
            {/* プリセット期間 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { key: 'today', label: '今日' },
                { key: 'week', label: '過去7日' },
                { key: 'month', label: '過去30日' },
                { key: 'thisMonth', label: '今月' },
                { key: 'quarter', label: '過去3ヶ月' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPresetPeriod(key)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">開始日</label>
                <input
                  type="date"
                  {...register('filters.startDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.filters?.startDate && (
                  <p className="text-sm text-red-600 mt-1">{errors.filters.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">終了日</label>
                <input
                  type="date"
                  {...register('filters.endDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.filters?.endDate && (
                  <p className="text-sm text-red-600 mt-1">{errors.filters.endDate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* 店舗・部門・カテゴリフィルター */}
          {watchedValues.dataType === 'sales' || watchedValues.dataType === 'combined' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  店舗
                </label>
                <select
                  {...register('filters.storeId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全店舗</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  部門
                </label>
                <select
                  {...register('filters.department')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部門</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">カテゴリ</label>
                <select
                  {...register('filters.category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全カテゴリ</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        {/* レート制限表示 */}
        {rateLimitInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Clock className="w-4 h-4" />
              <span className="font-medium">エクスポート制限</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              残り {rateLimitInfo.remainingRequests} / {rateLimitInfo.maxRequests} 回
              （リセット: {new Date(rateLimitInfo.resetTime).toLocaleTimeString()}）
            </p>
          </div>
        )}

        {/* ステータス表示 */}
        {status.message && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{status.message}</span>
          </div>
        )}

        {status.error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{status.error}</span>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handlePreview}
            disabled={status.isExporting}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-md"
          >
            プレビュー
          </button>
          
          <button
            type="submit"
            disabled={status.isExporting || (rateLimitInfo?.remainingRequests || 0) <= 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium"
          >
            {status.isExporting ? 'エクスポート中...' : 'エクスポート実行'}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={status.isExporting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            リセット
          </button>
        </div>
      </form>

      {/* プレビューデータ表示 */}
      {previewData && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">データプレビュー</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-auto">
            <pre className="text-xs text-gray-700">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
