import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            経営戦略ダッシュボード
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            外部指標×売上で意思決定を加速
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link href="/dashboard" className="card hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📊 ダッシュボード
              </h3>
              <p className="text-gray-600">
                KPI・外部指標・売上データの統合表示
              </p>
            </Link>
            
            <Link href="/sales" className="card hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                💰 売上入力
              </h3>
              <p className="text-gray-600">
                店舗別売上データの入力・管理
              </p>
            </Link>
            
            <Link href="/export" className="card hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📤 エクスポート
              </h3>
              <p className="text-gray-600">
                CSV・Excel形式でのデータ出力
              </p>
            </Link>
          </div>
          
          <div className="mt-12">
            <button className="btn-primary mr-4">
              ログイン
            </button>
            <Link href="/docs" className="btn-secondary">
              ドキュメント
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}