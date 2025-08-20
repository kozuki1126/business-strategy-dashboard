/**
 * ExportForm コンポーネント ユニットテスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, subDays } from 'date-fns';
import ExportForm from '@/components/export/ExportForm';

// モック
global.fetch = jest.fn();
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

const mockStores = [
  { id: 'store1', name: '店舗A' },
  { id: 'store2', name: '店舗B' }
];

const mockDepartments = [
  { id: 'dept1', name: '部門1' },
  { id: 'dept2', name: '部門2' }
];

const mockCategories = [
  { id: 'cat1', name: 'カテゴリA' },
  { id: 'cat2', name: 'カテゴリB' }
];

const mockRateLimitResponse = {
  rateLimit: {
    maxRequests: 5,
    remainingRequests: 3,
    resetTime: Date.now() + 3600000,
    windowMs: 3600000
  },
  supportedFormats: ['csv', 'excel'],
  supportedDataTypes: ['sales', 'external', 'combined']
};

describe('ExportForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRateLimitResponse)
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders export form correctly', async () => {
    render(
      <ExportForm 
        stores={mockStores}
        departments={mockDepartments}
        categories={mockCategories}
      />
    );

    // タイトル確認
    expect(screen.getByText('データエクスポート')).toBeInTheDocument();

    // データタイプ選択肢確認
    expect(screen.getByText('売上データ')).toBeInTheDocument();
    expect(screen.getByText('外部データ')).toBeInTheDocument();
    expect(screen.getByText('統合データ')).toBeInTheDocument();

    // フォーマット選択肢確認
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();

    // フィルター設定確認
    expect(screen.getByText('フィルター設定')).toBeInTheDocument();
    expect(screen.getByLabelText('開始日')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日')).toBeInTheDocument();

    // ボタン確認
    expect(screen.getByText('プレビュー')).toBeInTheDocument();
    expect(screen.getByText('エクスポート実行')).toBeInTheDocument();
    expect(screen.getByText('リセット')).toBeInTheDocument();

    // レート制限情報の読み込み確認
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/export');
    });
  });

  test('displays rate limit information', async () => {
    render(<ExportForm />);

    await waitFor(() => {
      expect(screen.getByText('エクスポート制限')).toBeInTheDocument();
      expect(screen.getByText(/残り 3 \/ 5 回/)).toBeInTheDocument();
    });
  });

  test('applies preset date ranges correctly', async () => {
    render(<ExportForm />);

    // 「過去7日」プリセットをクリック
    await user.click(screen.getByText('過去7日'));

    const startDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
    const endDateInput = screen.getByLabelText('終了日') as HTMLInputElement;

    const expectedStartDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const expectedEndDate = format(new Date(), 'yyyy-MM-dd');

    expect(startDateInput.value).toBe(expectedStartDate);
    expect(endDateInput.value).toBe(expectedEndDate);
  });

  test('shows store/department filters only for sales or combined data', async () => {
    render(
      <ExportForm 
        stores={mockStores}
        departments={mockDepartments}
        categories={mockCategories}
      />
    );

    // 初期状態（sales選択）では表示
    expect(screen.getByText('店舗')).toBeInTheDocument();
    expect(screen.getByText('部門')).toBeInTheDocument();

    // 外部データ選択時は非表示
    await user.click(screen.getByRole('radio', { name: /外部データ/ }));
    expect(screen.queryByText('店舗')).not.toBeInTheDocument();
    expect(screen.queryByText('部門')).not.toBeInTheDocument();

    // 統合データ選択時は再表示
    await user.click(screen.getByRole('radio', { name: /統合データ/ }));
    expect(screen.getByText('店舗')).toBeInTheDocument();
    expect(screen.getByText('部門')).toBeInTheDocument();
  });

  test('handles export successfully', async () => {
    const mockBlob = new Blob(['test data'], { type: 'text/csv' });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) => {
            if (name === 'content-disposition') {
              return 'attachment; filename="test_export.csv"';
            }
            return null;
          }
        }
      });

    // DOM要素のモック
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };
    document.createElement = jest.fn().mockReturnValue(mockLink);
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    render(<ExportForm />);

    // エクスポート実行
    await user.click(screen.getByText('エクスポート実行'));

    // 処理中メッセージ確認
    expect(screen.getByText('エクスポート処理中...')).toBeInTheDocument();

    // API呼び出し確認
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"dataType":"sales"')
      });
    });

    // 成功メッセージ確認
    await waitFor(() => {
      expect(screen.getByText('エクスポートが完了しました')).toBeInTheDocument();
    });

    // ダウンロード処理確認
    expect(mockLink.href).toBe('mock-url');
    expect(mockLink.download).toBe('test_export.csv');
    expect(mockLink.click).toHaveBeenCalled();
  });

  test('handles export error gracefully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'Export failed',
          message: 'サーバーエラーが発生しました'
        })
      });

    render(<ExportForm />);

    await user.click(screen.getByText('エクスポート実行'));

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });
  });

  test('prevents export when rate limit is exceeded', async () => {
    const rateLimitExceeded = {
      ...mockRateLimitResponse,
      rateLimit: {
        ...mockRateLimitResponse.rateLimit,
        remainingRequests: 0
      }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rateLimitExceeded)
    });

    render(<ExportForm />);

    await waitFor(() => {
      const exportButton = screen.getByText('エクスポート実行');
      expect(exportButton).toBeDisabled();
    });
  });

  test('handles preview functionality', async () => {
    const mockPreviewData = {
      data: [{ id: 1, name: 'test' }],
      total: 1
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreviewData)
      });

    render(<ExportForm />);

    await user.click(screen.getByText('プレビュー'));

    // プレビュー処理中メッセージ
    expect(screen.getByText('プレビューデータ取得中...')).toBeInTheDocument();

    // プレビューデータ表示確認
    await waitFor(() => {
      expect(screen.getByText('データプレビュー')).toBeInTheDocument();
      expect(screen.getByText('プレビューデータを取得しました')).toBeInTheDocument();
    });
  });

  test('resets form correctly', async () => {
    render(<ExportForm />);

    // フォームに値を入力
    await user.click(screen.getByRole('radio', { name: /外部データ/ }));
    await user.click(screen.getByRole('radio', { name: /Excel/ }));
    await user.type(screen.getByLabelText('開始日'), '2025-01-01');

    // リセット実行
    await user.click(screen.getByText('リセット'));

    // デフォルト値に戻っていることを確認
    expect(screen.getByRole('radio', { name: /売上データ/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /CSV/ })).toBeChecked();
    
    const startDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
    expect(startDateInput.value).toBe('');
  });

  test('validates form inputs', async () => {
    render(<ExportForm />);

    // 無効な日付範囲を設定
    await user.type(screen.getByLabelText('開始日'), '2025-01-31');
    await user.type(screen.getByLabelText('終了日'), '2025-01-01');

    await user.click(screen.getByText('エクスポート実行'));

    // バリデーションエラーメッセージを確認
    await waitFor(() => {
      expect(screen.getByText(/開始日は終了日/)).toBeInTheDocument();
    });
  });

  test('updates rate limit info after successful export', async () => {
    const updatedRateLimit = {
      ...mockRateLimitResponse,
      rateLimit: {
        ...mockRateLimitResponse.rateLimit,
        remainingRequests: 2
      }
    };

    const mockBlob = new Blob(['test data'], { type: 'text/csv' });
    
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: () => 'attachment; filename="test.csv"'
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedRateLimit)
      });

    // DOM要素のモック
    document.createElement = jest.fn().mockReturnValue({
      href: '',
      download: '',
      click: jest.fn()
    });
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    render(<ExportForm />);

    // 初期のレート制限確認
    await waitFor(() => {
      expect(screen.getByText(/残り 3 \/ 5 回/)).toBeInTheDocument();
    });

    // エクスポート実行
    await user.click(screen.getByText('エクスポート実行'));

    // 更新されたレート制限確認
    await waitFor(() => {
      expect(screen.getByText(/残り 2 \/ 5 回/)).toBeInTheDocument();
    });
  });

  test('populates store, department, and category options', async () => {
    render(
      <ExportForm 
        stores={mockStores}
        departments={mockDepartments}
        categories={mockCategories}
      />
    );

    // 店舗オプション確認
    const storeSelect = screen.getByText('店舗').closest('div')?.querySelector('select');
    expect(storeSelect).toBeInTheDocument();
    
    // 部門オプション確認
    const deptSelect = screen.getByText('部門').closest('div')?.querySelector('select');
    expect(deptSelect).toBeInTheDocument();

    // カテゴリオプション確認
    const categorySelect = screen.getByText('カテゴリ').closest('div')?.querySelector('select');
    expect(categorySelect).toBeInTheDocument();
  });

  test('handles custom onExport prop', async () => {
    const mockOnExport = jest.fn().mockResolvedValue(undefined);

    render(<ExportForm onExport={mockOnExport} />);

    await user.click(screen.getByText('エクスポート実行'));

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: 'sales',
          format: 'csv'
        })
      );
    });

    expect(screen.getByText('エクスポートが完了しました')).toBeInTheDocument();
  });

  test('disables buttons during export process', async () => {
    const mockOnExport = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<ExportForm onExport={mockOnExport} />);

    const exportButton = screen.getByText('エクスポート実行');
    const previewButton = screen.getByText('プレビュー');
    const resetButton = screen.getByText('リセット');

    await user.click(exportButton);

    // ボタンが無効化されていることを確認
    expect(exportButton).toBeDisabled();
    expect(previewButton).toBeDisabled();
    expect(resetButton).toBeDisabled();

    expect(screen.getByText('エクスポート処理中...')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <ExportForm className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('handles network errors gracefully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<ExportForm />);

    await user.click(screen.getByText('エクスポート実行'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('handles rate limit info fetch failure', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch rate limit info'));

    // エラーがコンソールに記録される
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<ExportForm />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch rate limit info:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  test('clears preview data on reset', async () => {
    const mockPreviewData = { data: [{ id: 1 }] };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRateLimitResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreviewData)
      });

    render(<ExportForm />);

    // プレビュー実行
    await user.click(screen.getByText('プレビュー'));

    await waitFor(() => {
      expect(screen.getByText('データプレビュー')).toBeInTheDocument();
    });

    // リセット実行
    await user.click(screen.getByText('リセット'));

    // プレビューデータが消えていることを確認
    expect(screen.queryByText('データプレビュー')).not.toBeInTheDocument();
  });

  test('shows all preset period buttons', () => {
    render(<ExportForm />);

    expect(screen.getByText('今日')).toBeInTheDocument();
    expect(screen.getByText('過去7日')).toBeInTheDocument();
    expect(screen.getByText('過去30日')).toBeInTheDocument();
    expect(screen.getByText('今月')).toBeInTheDocument();
    expect(screen.getByText('過去3ヶ月')).toBeInTheDocument();
  });
});
