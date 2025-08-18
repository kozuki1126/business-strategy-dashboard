'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [selectedStore, setSelectedStore] = useState('all');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            経営戦略ダッシュボード
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
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
              <option value="store-1">店舗1</option>
              <option value="store-2">店舗2</option>
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
              <p className="text-gray-500">グラフエリア（Recharts実装予定）</p>
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
                <span className="text-gray-600">天候</span>
                <span className="font-medium">☀️ 晴れ</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}