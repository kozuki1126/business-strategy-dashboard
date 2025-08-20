/**
 * 相関分析コンポーネント
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Building2, 
  Users, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Activity,
  Sun,
  Cloud,
  CloudRain,
  Calendar as CalendarIcon
} from 'lucide-react';
import { z } from 'zod';

// 分析フィルタースキーマ
const CorrelationFiltersSchema = z.object({
  startDate: z.string().min(1, '開始日が必要です'),
  endDate: z.string().min(1, '終了日が必要です'),
  storeId: z.string().optional(),
  department: z.string().optional(),
  category: z.string().optional(),
});

type CorrelationFilters = z.infer<typeof CorrelationFiltersSchema>;

// デフォルトフィルター
const DEFAULT_FILTERS: CorrelationFilters = {
  startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
};

interface CorrelationAnalysisProps {
  stores?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  className?: string;
}

interface AnalysisStatus {
  isAnalyzing: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

interface CorrelationResult {
  factor: string;
  correlation: number;
  significance: number;
  sampleSize: number;
  description: string;
}

interface HeatmapData {
  x: string;
  y: string;
  value: number;
  tooltip?: string;
}

interface ComparisonData {
  date: string;
  current: number;
  previousDay: number;
  previousYear: number;
  dayOfWeek: string;
  weather?: string;
  hasEvent?: boolean;
}

interface AnalysisResults {
  correlations: CorrelationResult[];
  heatmapData: HeatmapData[];
  comparisonData: ComparisonData[];
  summary: {
    strongestPositive: CorrelationResult | null;
    strongestNegative: CorrelationResult | null;
    totalAnalyzedDays: number;
    averageDailySales: number;
  };
}

export default function CorrelationAnalysis({ 
  stores = [], 
  departments = [], 
  categories = [], 
  className = '' 
}: CorrelationAnalysisProps) {
  const [status, setStatus] = useState<AnalysisStatus>({ isAnalyzing: false });
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [configInfo, setConfigInfo] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<CorrelationFilters>({
    resolver: zodResolver(CorrelationFiltersSchema),
    defaultValues: DEFAULT_FILTERS
  });

  const watchedValues = watch();

  // 設定情報取得
  useEffect(() => {
    fetchConfigInfo();
  }, []);

  const fetchConfigInfo = async () => {
    try {
      const response = await fetch('/api/analytics/correlation');
      if (response.ok) {
        const data = await response.json();
        setConfigInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch config info:', error);
    }
  };

  // プリセット期間設定
  const setPresetPeriod = (preset: string) => {
    const today = new Date();
    let startDate: Date;
    let endDate = today;

    switch (preset) {
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
      case 'halfYear':
        startDate = subDays(today, 180);
        break;
      default:
        return;
    }

    setValue('startDate', format(startDate, 'yyyy-MM-dd'));
    setValue('endDate', format(endDate, 'yyyy-MM-dd'));
  };

  // 相関分析実行
  const handleAnalyze = async (data: CorrelationFilters) => {
    try {
      setStatus({ isAnalyzing: true, message: '相関分析を実行中...' });
      setResults(null);

      const response = await fetch('/api/analytics/correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: data })
      });

      if (response.ok) {
        const responseData = await response.json();
        setResults(responseData.data);
        setStatus({ 
          isAnalyzing: false, 
          message: `分析完了（処理時間: ${responseData.meta.processingTime}ms）` 
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '分析に失敗しました');
      }
    } catch (error) {
      setStatus({ 
        isAnalyzing: false, 
        error: error instanceof Error ? error.message : '分析エラー'
      });
    }
  };

  // リセット
  const handleReset = () => {
    reset(DEFAULT_FILTERS);
    setResults(null);
    setStatus({ isAnalyzing: false });
  };

  // 相関強度の色分け
  const getCorrelationColor = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return correlation > 0 ? 'text-emerald-600' : 'text-red-600';
    if (abs >= 0.5) return correlation > 0 ? 'text-blue-600' : 'text-orange-600';
    if (abs >= 0.3) return correlation > 0 ? 'text-green-600' : 'text-yellow-600';
    return 'text-gray-500';
  };

  // 相関強度の説明
  const getCorrelationStrength = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return '強い相関';
    if (abs >= 0.5) return '中程度の相関';
    if (abs >= 0.3) return '弱い相関';
    return 'ほぼ無相関';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className=\"flex items-center gap-3 mb-6\">
        <BarChart3 className=\"w-6 h-6 text-blue-600\" />
        <h2 className=\"text-xl font-semibold text-gray-900\">相関・比較分析</h2>
      </div>

      <form onSubmit={handleSubmit(handleAnalyze)} className=\"space-y-6\">
        {/* 分析期間設定 */}
        <div className=\"space-y-4 border-b pb-6\">
          <div className=\"flex items-center gap-2\">
            <CalendarIcon className=\"w-4 h-4 text-gray-600\" />
            <h3 className=\"text-lg font-medium text-gray-900\">分析期間設定</h3>
          </div>

          {/* プリセット期間 */}
          <div className=\"flex flex-wrap gap-2 mb-3\">
            {[
              { key: 'week', label: '過去7日' },
              { key: 'month', label: '過去30日' },
              { key: 'thisMonth', label: '今月' },
              { key: 'quarter', label: '過去3ヶ月' },
              { key: 'halfYear', label: '過去6ヶ月' }
            ].map(({ key, label }) => (
              <button
                key={key}
                type=\"button\"
                onClick={() => setPresetPeriod(key)}
                className=\"px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors\"
              >
                {label}
              </button>
            ))}
          </div>

          <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-4\">
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">開始日</label>
              <input
                type=\"date\"
                {...register('startDate')}
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
              />
              {errors.startDate && (
                <p className=\"text-sm text-red-600 mt-1\">{errors.startDate.message}</p>
              )}
            </div>
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">終了日</label>
              <input
                type=\"date\"
                {...register('endDate')}
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
              />
              {errors.endDate && (
                <p className=\"text-sm text-red-600 mt-1\">{errors.endDate.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* フィルター設定 */}
        <div className=\"space-y-4 border-b pb-6\">
          <div className=\"flex items-center gap-2\">
            <Filter className=\"w-4 h-4 text-gray-600\" />
            <h3 className=\"text-lg font-medium text-gray-900\">フィルター設定</h3>
          </div>

          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">
                <Building2 className=\"w-4 h-4 inline mr-1\" />
                店舗
              </label>
              <select
                {...register('storeId')}
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
              >
                <option value=\"\">全店舗</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">
                <Users className=\"w-4 h-4 inline mr-1\" />
                部門
              </label>
              <select
                {...register('department')}
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
              >
                <option value=\"\">全部門</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className=\"block text-sm text-gray-600 mb-1\">カテゴリ</label>
              <select
                {...register('category')}
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
              >
                <option value=\"\">全カテゴリ</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 分析制限情報 */}
        {configInfo && (
          <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
            <div className=\"flex items-center gap-2 text-blue-800\">
              <Activity className=\"w-4 h-4\" />
              <span className=\"font-medium\">分析機能</span>
            </div>
            <p className=\"text-sm text-blue-700 mt-1\">
              処理時間: {configInfo.config.performanceSLA} | 
              最大期間: {configInfo.config.maxAnalysisPeriod} | 
              分析要因: {configInfo.config.supportedFactors.length}種類
            </p>
          </div>
        )}

        {/* ステータス表示 */}
        {status.message && (
          <div className=\"flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800\">
            <CheckCircle className=\"w-4 h-4\" />
            <span className=\"text-sm\">{status.message}</span>
          </div>
        )}

        {status.error && (
          <div className=\"flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800\">
            <AlertCircle className=\"w-4 h-4\" />
            <span className=\"text-sm\">{status.error}</span>
          </div>
        )}

        {/* アクションボタン */}
        <div className=\"flex flex-wrap gap-3 pt-4\">
          <button
            type=\"submit\"
            disabled={status.isAnalyzing}
            className=\"px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium\"
          >
            {status.isAnalyzing ? '分析中...' : '相関分析実行'}
          </button>
          
          <button
            type=\"button\"
            onClick={handleReset}
            disabled={status.isAnalyzing}
            className=\"px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50\"
          >
            リセット
          </button>
        </div>
      </form>

      {/* 分析結果表示 */}
      {results && (
        <div className=\"mt-8 space-y-6 border-t pt-6\">
          <h3 className=\"text-lg font-medium text-gray-900\">分析結果</h3>

          {/* サマリー */}
          <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4\">
            <div className=\"bg-blue-50 p-4 rounded-lg\">
              <div className=\"text-sm text-blue-600 font-medium\">分析期間</div>
              <div className=\"text-lg font-bold text-blue-900\">{results.summary.totalAnalyzedDays}日</div>
            </div>
            <div className=\"bg-green-50 p-4 rounded-lg\">
              <div className=\"text-sm text-green-600 font-medium\">平均日売上</div>
              <div className=\"text-lg font-bold text-green-900\">
                ¥{results.summary.averageDailySales.toLocaleString()}
              </div>
            </div>
            <div className=\"bg-emerald-50 p-4 rounded-lg\">
              <div className=\"text-sm text-emerald-600 font-medium flex items-center gap-1\">
                <TrendingUp className=\"w-4 h-4\" />
                最強正の相関
              </div>
              <div className=\"text-sm font-bold text-emerald-900\">
                {results.summary.strongestPositive?.factor || 'なし'}
              </div>
              {results.summary.strongestPositive && (
                <div className=\"text-xs text-emerald-700\">
                  r = {results.summary.strongestPositive.correlation.toFixed(3)}
                </div>
              )}
            </div>
            <div className=\"bg-red-50 p-4 rounded-lg\">
              <div className=\"text-sm text-red-600 font-medium flex items-center gap-1\">
                <TrendingDown className=\"w-4 h-4\" />
                最強負の相関
              </div>
              <div className=\"text-sm font-bold text-red-900\">
                {results.summary.strongestNegative?.factor || 'なし'}
              </div>
              {results.summary.strongestNegative && (
                <div className=\"text-xs text-red-700\">
                  r = {results.summary.strongestNegative.correlation.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {/* 相関係数リスト */}
          <div>
            <h4 className=\"text-md font-medium text-gray-900 mb-3\">相関係数一覧</h4>
            <div className=\"space-y-2\">
              {results.correlations.map((corr, index) => (
                <div key={index} className=\"flex items-center justify-between p-3 bg-gray-50 rounded-lg\">
                  <div className=\"flex items-center gap-3\">
                    <div className=\"flex items-center gap-1\">
                      {corr.factor.includes('気温') && <Sun className=\"w-4 h-4 text-orange-500\" />}
                      {corr.factor.includes('湿度') && <Cloud className=\"w-4 h-4 text-blue-500\" />}
                      {corr.factor.includes('雨') && <CloudRain className=\"w-4 h-4 text-gray-600\" />}
                      {corr.factor.includes('曜日') && <CalendarIcon className=\"w-4 h-4 text-purple-500\" />}
                      {corr.factor.includes('イベント') && <Activity className=\"w-4 h-4 text-green-500\" />}
                      <span className=\"font-medium\">{corr.factor}</span>
                    </div>
                    <span className=\"text-sm text-gray-600\">
                      (n={corr.sampleSize})
                    </span>
                  </div>
                  <div className=\"text-right\">
                    <div className={`font-bold ${getCorrelationColor(corr.correlation)}`}>
                      {corr.correlation.toFixed(3)}
                    </div>
                    <div className=\"text-xs text-gray-500\">
                      {getCorrelationStrength(corr.correlation)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ヒートマッププレビュー */}
          {results.heatmapData.length > 0 && (
            <div>
              <h4 className=\"text-md font-medium text-gray-900 mb-3\">曜日×天候ヒートマップ</h4>
              <div className=\"bg-gray-50 rounded-lg p-4\">
                <div className=\"grid grid-cols-8 gap-1 text-xs\">
                  <div></div>
                  {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                    <div key={day} className=\"text-center font-medium\">{day}</div>
                  ))}
                  {['晴', '曇', '雨', 'その他'].map(weather => (
                    <React.Fragment key={weather}>
                      <div className=\"text-right font-medium pr-2\">{weather}</div>
                      {['日', '月', '火', '水', '木', '金', '土'].map(day => {
                        const data = results.heatmapData.find(d => d.x === day && d.y === weather);
                        const intensity = data ? Math.min(Math.max(data.value - 0.5, 0) * 2, 1) : 0;
                        const bgColor = data ? 
                          (data.value > 1 ? `bg-green-${Math.floor(intensity * 500 + 100)}` : `bg-red-${Math.floor((1-intensity) * 300 + 100)}`) :
                          'bg-gray-100';
                        return (
                          <div
                            key={`${day}-${weather}`}
                            className={`h-8 w-8 rounded ${bgColor} flex items-center justify-center`}
                            title={data?.tooltip}
                          >
                            {data && (
                              <span className=\"text-xs font-medium\">
                                {(data.value * 100).toFixed(0)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <div className=\"text-xs text-gray-600 mt-2\">
                  * 数値は全体平均を100とした場合の相対値
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
