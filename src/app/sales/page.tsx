import { Metadata } from 'next';
import { SalesForm } from '@/components/sales/SalesForm';

export const metadata: Metadata = {
  title: '売上入力 | 経営戦略ダッシュボード',
  description: '店舗の売上データを入力・管理',
};

export default function SalesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <SalesForm />
      </div>
    </div>
  );
}