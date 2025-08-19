'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

interface NavigationItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}

interface NavigationProps {
  className?: string;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'ダッシュボード',
    href: '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: '売上・市場指標の可視化',
  },
  {
    name: '売上入力',
    href: '/sales',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    description: '店舗売上データの入力・管理',
  },
  {
    name: 'エクスポート',
    href: '/export',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'CSV・Excelファイル出力',
  },
];

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={clsx('flex space-x-4', className)}>
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={clsx(
              'inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              {
                'bg-primary-100 text-primary-900 border border-primary-200': isActive,
                'text-gray-600 hover:text-gray-900 hover:bg-gray-50': !isActive,
              }
            )}
            title={item.description}
          >
            {item.icon && (
              <span className="mr-2">
                {item.icon}
              </span>
            )}
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

// モバイル用ドロップダウンメニュー
export function MobileNavigation({ className }: NavigationProps) {
  const pathname = usePathname();

  return (
    <div className={clsx('md:hidden', className)}>
      <div className="space-y-1 px-2 pb-3 pt-2">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors',
                {
                  'bg-primary-100 text-primary-900': isActive,
                  'text-gray-600 hover:text-gray-900 hover:bg-gray-50': !isActive,
                }
              )}
            >
              {item.icon && (
                <span className="mr-3">
                  {item.icon}
                </span>
              )}
              <div>
                <div>{item.name}</div>
                {item.description && (
                  <div className="text-xs text-gray-500 mt-1">
                    {item.description}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// クイックアクションボタン
export function QuickActions({ className }: NavigationProps) {
  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      <Link
        href="/sales"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
      >
        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        売上入力
      </Link>
      
      <Link
        href="/export"
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
      >
        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        エクスポート
      </Link>
    </div>
  );
}