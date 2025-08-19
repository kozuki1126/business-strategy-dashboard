'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth, useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useRequireAuth();
  const { signOut } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [selectedStore, setSelectedStore] = useState('all');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        // In a production app, you might want to show an error message
      }
      // The auth context will handle the redirect
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, the useRequireAuth hook will redirect
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              経営戦略ダッシュボード
            </h1>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{getUserDisplayName(user)}</span>
                <span className="text-gray-400 ml-2">でログイン中</span>
              </div>
              
              <Button
                onClick={handleSignOut}
                disabled={isSigningOut}
                variant="outline"
                size="sm"
              >
                {isSigningOut ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ログアウト中...
                  </>
                ) : (
                  'ログアウト'
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Welcome message */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h2 className="text-lg font-semibold text-blue-900 mb-1">
            ようこそ、{getUserDisplayName(user)}さん
          </h2>
          <p className="text-sm text-blue-700">
            外部指標と売上データを統合したダッシュボードで、意思決定を加速しましょう。
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div>
            <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
              期間
            </label>
            <select
              id="period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="input"
            >
              <option value="current-month">当月</option>
              <option value="last-month">前月</option>
              <option value="current-year">当年</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="store" className="block text-sm font-medium text-gray-700 mb-1">
              店舗
            </label>
            <select
              id="store"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="input"
            >
              <option value="all">全店舗</option>
              <option value="store-1">東京店</option>
              <option value="store-2">大阪店</option>
              <option value="store-3">名古屋店</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">売上（税抜）</h3>
            <p className="text-2xl font-bold text-gray-900">¥12,345,678</p>
            <p className="text-sm text-green-600">+5.2% vs 前月</p>
          </div>
          
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">客数</h3>
            <p className="text-2xl font-bold text-gray-900">8,742</p>
            <p className="text-sm text-red-600">-2.1% vs 前月</p>
          </div>
          
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">客単価</h3>
            <p className="text-2xl font-bold text-gray-900">¥1,413</p>
            <p className="text-sm text-green-600">+7.5% vs 前月</p>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
            <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
              <p className="text-gray-500">グラフエリア（#006で実装予定）</p>
            </div>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">外部指標</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">USD/JPY</span>
                <span className="font-medium">¥150.25</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">日経225</span>
                <span className="font-medium">33,425.50</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">天候（東京）</span>
                <span className="font-medium">☀️ 晴れ</span>
              </div>
              <div className="text-xs text-gray-500 mt-4">
                ※ 実際の外部データは#008 ETLスケジューラで実装予定
              </div>
            </div>
          </div>
        </div>

        {/* Development Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">開発情報</h4>
            <div className="text-xs text-yellow-700 space-y-1">
              <p>• 認証システム: ✅ 完了 (#005)</p>
              <p>• データベース接続: ✅ 完了 (#003, #004)</p>
              <p>• 次の実装: #006 ダッシュボードUI（実データ連携）</p>
              <p>• ユーザーID: {user?.id}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
