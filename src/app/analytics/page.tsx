/**
 * アナリティクスページ - 相関・比較分析
 * /analytics
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AuditService } from '@/lib/services/audit';
import CorrelationAnalysis from '@/components/analytics/CorrelationAnalysis';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Calculator,
  AlertCircle 
} from 'lucide-react';

// マスターデータ型定義
interface MasterData {
  stores: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

async function fetchMasterData(): Promise<MasterData> {
  const supabase = createClient();
  
  try {
    // 並列でマスターデータを取得
    const [storesResult, departmentsResult, categoriesResult] = await Promise.all([
      supabase.from('dim_store').select('id, name').order('name'),
      supabase.from('dim_department').select('id, name').order('name'),
      supabase.from('dim_product_category').select('id, name').order('name')
    ]);

    return {
      stores: storesResult.data || [],
      departments: departmentsResult.data || [],
      categories: categoriesResult.data || []
    };
  } catch (error) {
    console.error('Failed to fetch master data:', error);
    return {
      stores: [],
      departments: [],
      categories: []
    };
  }
}

/**
 * ローディングコンポーネント
 */
function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-6 bg-gray-300 rounded"></div>
              <div className="h-6 bg-gray-300 rounded w-48"></div>
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              <div className="h-32 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * アナリティクスページメインコンポーネント
 */
export default async function AnalyticsPage() {
  // 認証確認
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  try {
    // マスターデータ取得
    const masterData = await fetchMasterData();

    // 監査ログ記録
    await AuditService.log({
      actor_id: user.id,
      action: 'view_analytics_page',
      target: 'analytics_page',
      metadata: {
        timestamp: new Date().toISOString(),
        masterDataCounts: {
          stores: masterData.stores.length,
          departments: masterData.departments.length,
          categories: masterData.categories.length
        }
      }
    });

    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダーセクション */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      アナリティクス
                    </h1>
                    <p className="text-sm text-gray-600">
                      売上と外部要因の相関・比較分析
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>リアルタイム分析</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>統計的相関</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    <span>ヒートマップ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* 機能説明カード */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-900 mb-2">
                    相関・比較分析機能
                  </h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>曜日パターン分析</strong>: 曜日別の売上傾向と相関係数</p>
                    <p>• <strong>天候影響分析</strong>: 気温・湿度・降水量・天候状況との相関</p>
                    <p>• <strong>イベント効果分析</strong>: 近隣イベント開催日の売上への影響</p>
                    <p>• <strong>時系列比較</strong>: 前日比・前年比・期間比較分析</p>
                    <p>• <strong>ヒートマップ可視化</strong>: 曜日×天候の売上パターン表示</p>
                  </div>
                </div>
              </div>
            </div>

            {/* データ統計サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">利用可能店舗</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {masterData.stores.length}店舗
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">分析可能部門</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {masterData.departments.length}部門
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">商品カテゴリ</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {masterData.categories.length}種類
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 相関分析コンポーネント */}
            <Suspense fallback={<AnalyticsLoading />}>
              <CorrelationAnalysis
                stores={masterData.stores}
                departments={masterData.departments}
                categories={masterData.categories}
                className="w-full"
              />
            </Suspense>

            {/* 使用方法ガイド */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                使用方法ガイド
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">📊 基本的な使い方</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>分析期間を設定（プリセットまたは手動選択）</li>
                    <li>必要に応じて店舗・部門・カテゴリでフィルタ</li>
                    <li>「相関分析実行」ボタンをクリック</li>
                    <li>結果の相関係数とヒートマップを確認</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">📈 分析結果の見方</h4>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong>相関係数</strong>: -1.0〜1.0の範囲（0.7以上で強い相関）</li>
                    <li><strong>ヒートマップ</strong>: 数値は全体平均を100とした相対値</li>
                    <li><strong>比較データ</strong>: 前日比・前年比の変化率</li>
                    <li><strong>サンプルサイズ</strong>: 分析に使用したデータ数</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  } catch (error) {
    console.error('Analytics page error:', error);
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">エラーが発生しました</h2>
          </div>
          <p className="text-gray-700 mb-4">
            アナリティクスページの読み込み中にエラーが発生しました。
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              再読み込み
            </button>
            <a 
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              ダッシュボードに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }
}

// メタデータ
export const metadata = {
  title: 'アナリティクス | 経営戦略ダッシュボード',
  description: '売上と外部要因の相関・比較分析を実行',
};
