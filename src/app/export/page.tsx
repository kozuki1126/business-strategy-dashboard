/**
 * エクスポートページ
 * /export
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ExportForm from '@/components/export/ExportForm';
import { AuditService } from '@/lib/services/audit';

// ページメタデータ
export const metadata = {
  title: 'データエクスポート - Business Strategy Dashboard',
  description: 'データをCSV・Excel形式でエクスポート',
};

async function getStoreData() {
  const supabase = createClient();
  
  const { data: stores } = await supabase
    .from('dim_store')
    .select('id, name')
    .order('name');
    
  const { data: departments } = await supabase
    .from('dim_department')
    .select('id, name')
    .order('name');
    
  const { data: categories } = await supabase
    .from('dim_product_category')
    .select('id, name')
    .order('name');

  return {
    stores: stores || [],
    departments: departments || [],
    categories: categories || []
  };
}

export default async function ExportPage() {
  // 認証確認
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  // ページアクセス監査ログ
  await AuditService.log({
    actor_id: user.id,
    action: 'view_export_page',
    target: 'export_page',
    metadata: {
      timestamp: new Date().toISOString()
    }
  });

  // マスターデータ取得
  const { stores, departments, categories } = await getStoreData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">データエクスポート</h1>
              <p className="text-gray-600 mt-1">
                売上データや外部データをCSV・Excel形式でダウンロードできます
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                ログイン中: {user.email}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                最大 5回/時間、1年分のデータまで
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExportForm 
          stores={stores}
          departments={departments}
          categories={categories}
        />
        
        {/* ヘルプセクション */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">エクスポート機能について</h2>
          
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">データタイプ</h3>
              <ul className="space-y-1 ml-4">
                <li>• <strong>売上データ</strong>: 日別売上、客数、取引数、税抜金額など</li>
                <li>• <strong>外部データ</strong>: 市場指標、為替レート、天候、イベント情報など</li>
                <li>• <strong>統合データ</strong>: 売上と外部データを組み合わせたデータセット</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">ファイル形式</h3>
              <ul className="space-y-1 ml-4">
                <li>• <strong>CSV</strong>: カンマ区切り値、UTF-8エンコード（Excel対応）</li>
                <li>• <strong>Excel</strong>: Microsoft Excel形式、複数シート対応</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">制限事項</h3>
              <ul className="space-y-1 ml-4">
                <li>• エクスポート回数: 5回/時間まで</li>
                <li>• 期間: 最大1年分のデータ</li>
                <li>• ファイルサイズ: 最大50MB</li>
                <li>• 処理時間: 5秒以内を目標</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">セキュリティ</h3>
              <ul className="space-y-1 ml-4">
                <li>• 全ての操作は監査ログに記録されます</li>
                <li>• ダウンロードファイルはキャッシュされません</li>
                <li>• 認証済みユーザーのみアクセス可能です</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">よくある質問</h3>
              <ul className="space-y-2 ml-4">
                <li>
                  <strong>Q: エクスポートが失敗する</strong><br />
                  A: 期間が長すぎる場合は短縮してください。システム負荷が高い場合は時間を置いて再試行してください。
                </li>
                <li>
                  <strong>Q: Excelで文字化けする</strong><br />
                  A: CSVファイルはUTF-8エンコードです。Excelで開く際は「データ」→「テキストファイル」から読み込んでください。
                </li>
                <li>
                  <strong>Q: 大量データを取得したい</strong><br />
                  A: 期間を分割して複数回エクスポートするか、統合データではなく個別データタイプを選択してください。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
