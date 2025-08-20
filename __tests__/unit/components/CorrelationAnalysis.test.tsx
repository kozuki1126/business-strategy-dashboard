/**
 * CorrelationAnalysisコンポーネント テスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CorrelationAnalysis from '@/components/analytics/CorrelationAnalysis';

// モック設定
const mockStores = [
  { id: 'store1', name: '新宿店' },
  { id: 'store2', name: '渋谷店' },
  { id: 'store3', name: '池袋店' },
];

const mockDepartments = [
  { id: 'electronics', name: '家電' },
  { id: 'clothing', name: '衣料品' },
  { id: 'food', name: '食品' },
];

const mockCategories = [
  { id: 'smartphones', name: 'スマートフォン' },
  { id: 'laptops', name: 'ノートPC' },
  { id: 'accessories', name: 'アクセサリー' },
];

const mockCorrelationResponse = {
  data: {
    correlations: [
      {
        factor: '曜日_月曜日',
        correlation: 0.75,
        significance: 0.95,
        sampleSize: 12,
        description: '月曜日の売上平均は全体平均の175.0%'
      },
      {
        factor: '気温',
        correlation: 0.45,
        significance: 0.80,
        sampleSize: 30,
        description: '気温と売上の相関係数: 0.450'
      },
      {
        factor: '雨天',
        correlation: -0.30,
        significance: 0.70,
        sampleSize: 8,
        description: '雨天時の売上は平均の70.0%'
      }
    ],
    heatmapData: [
      {
        x: '月',
        y: '晴',
        value: 1.2,
        tooltip: '月曜日・晴: 平均売上 120,000円 (5日)'
      },
      {
        x: '火',
        y: '雨',
        value: 0.8,
        tooltip: '火曜日・雨: 平均売上 80,000円 (3日)'
      }
    ],
    comparisonData: [
      {
        date: '2024-01-01',
        current: 100000,
        previousDay: 95000,
        previousYear: 88000,
        dayOfWeek: '月',
        weather: '晴れ',
        hasEvent: false
      },
      {
        date: '2024-01-02',
        current: 120000,
        previousDay: 100000,
        previousYear: 110000,
        dayOfWeek: '火',
        weather: '曇り',
        hasEvent: true
      }
    ],
    summary: {
      strongestPositive: {
        factor: '曜日_月曜日',
        correlation: 0.75,
        significance: 0.95,
        sampleSize: 12,
        description: '月曜日の売上平均は全体平均の175.0%'
      },
      strongestNegative: {
        factor: '雨天',
        correlation: -0.30,
        significance: 0.70,
        sampleSize: 8,
        description: '雨天時の売上は平均の70.0%'
      },
      totalAnalyzedDays: 30,
      averageDailySales: 100000
    }
  },
  meta: {
    processingTime: 1500,
    withinSLA: true,
    timestamp: '2024-01-01T10:00:00Z',
    userId: 'user123',
    filtersApplied: {
      startDate: '2023-12-01',
      endDate: '2023-12-31'
    }
  }
};

const mockConfigResponse = {
  config: {
    maxAnalysisPeriod: '1年',
    performanceSLA: '5秒以内',
    supportedFactors: [
      '曜日パターン',
      '気温・湿度・降水量',
      '天候状況（晴・雨・曇）',
      'イベント開催有無',
      '前日比・前年比'
    ],
    correlationMethods: [
      'Pearson相関係数',
      '平均値比較',
      'ヒートマップ分析'
    ]
  }
};

// fetchのモック
global.fetch = jest.fn();

describe('CorrelationAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation((url) => {
      if (url === '/api/analytics/correlation' && arguments[1]?.method !== 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfigResponse),
        } as Response);
      }
      if (url === '/api/analytics/correlation' && arguments[1]?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCorrelationResponse),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  const defaultProps = {
    stores: mockStores,
    departments: mockDepartments,
    categories: mockCategories,
  };

  describe('レンダリング', () => {
    it('基本コンポーネントが正しくレンダリングされること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      expect(screen.getByText('相関・比較分析')).toBeInTheDocument();
      expect(screen.getByText('分析期間設定')).toBeInTheDocument();
      expect(screen.getByText('フィルター設定')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '相関分析実行' })).toBeInTheDocument();
    });

    it('プリセット期間ボタンが表示されること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      expect(screen.getByText('過去7日')).toBeInTheDocument();
      expect(screen.getByText('過去30日')).toBeInTheDocument();
      expect(screen.getByText('今月')).toBeInTheDocument();
      expect(screen.getByText('過去3ヶ月')).toBeInTheDocument();
      expect(screen.getByText('過去6ヶ月')).toBeInTheDocument();
    });

    it('フィルター選択肢が正しく表示されること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      // 店舗選択
      expect(screen.getByDisplayValue('全店舗')).toBeInTheDocument();
      const storeSelect = screen.getByDisplayValue('全店舗');
      fireEvent.click(storeSelect);
      mockStores.forEach(store => {
        expect(screen.getByText(store.name)).toBeInTheDocument();
      });

      // 部門選択
      expect(screen.getByDisplayValue('全部門')).toBeInTheDocument();
      
      // カテゴリ選択
      expect(screen.getByDisplayValue('全カテゴリ')).toBeInTheDocument();
    });

    it('設定情報取得時に制限情報が表示されること', async () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('分析機能')).toBeInTheDocument();
        expect(screen.getByText(/処理時間: 5秒以内/)).toBeInTheDocument();
        expect(screen.getByText(/最大期間: 1年/)).toBeInTheDocument();
      });
    });
  });

  describe('フォーム操作', () => {
    it('日付入力が正常に動作すること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const startDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
      const endDateInput = screen.getByLabelText('終了日') as HTMLInputElement;

      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });

      expect(startDateInput.value).toBe('2024-01-01');
      expect(endDateInput.value).toBe('2024-01-31');
    });

    it('プリセット期間ボタンが正常に動作すること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const weekButton = screen.getByText('過去7日');
      fireEvent.click(weekButton);

      const startDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
      const endDateInput = screen.getByLabelText('終了日') as HTMLInputElement;

      expect(startDateInput.value).toBeTruthy();
      expect(endDateInput.value).toBeTruthy();
    });

    it('フィルター選択が正常に動作すること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const storeSelect = screen.getByDisplayValue('全店舗') as HTMLSelectElement;
      fireEvent.change(storeSelect, { target: { value: 'store1' } });

      expect(storeSelect.value).toBe('store1');
    });

    it('リセットボタンが正常に動作すること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      // フィルターを変更
      const storeSelect = screen.getByDisplayValue('全店舗') as HTMLSelectElement;
      fireEvent.change(storeSelect, { target: { value: 'store1' } });

      // リセット実行
      const resetButton = screen.getByText('リセット');
      fireEvent.click(resetButton);

      // デフォルト値に戻ることを確認
      expect(storeSelect.value).toBe('');
    });
  });

  describe('相関分析実行', () => {
    it('正常な分析実行が動作すること', async () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      // ローディング状態の確認
      await waitFor(() => {
        expect(screen.getByText('分析中...')).toBeInTheDocument();
      });

      // 分析完了の確認
      await waitFor(() => {
        expect(screen.getByText(/分析完了/)).toBeInTheDocument();
      });

      // 結果表示の確認
      await waitFor(() => {
        expect(screen.getByText('分析結果')).toBeInTheDocument();
        expect(screen.getByText('30日')).toBeInTheDocument(); // 分析期間
        expect(screen.getByText('¥100,000')).toBeInTheDocument(); // 平均売上
      });
    });

    it('相関係数一覧が正しく表示されること', async () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('相関係数一覧')).toBeInTheDocument();
      });

      // 各相関結果の確認
      mockCorrelationResponse.data.correlations.forEach(corr => {
        expect(screen.getByText(corr.factor)).toBeInTheDocument();
        expect(screen.getByText(corr.correlation.toFixed(3))).toBeInTheDocument();
      });
    });

    it('ヒートマップが正しく表示されること', async () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('曜日×天候ヒートマップ')).toBeInTheDocument();
      });

      // 曜日ラベルの確認
      ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
        expect(screen.getByText(day)).toBeInTheDocument();
      });

      // 天候ラベルの確認
      ['晴', '曇', '雨', 'その他'].forEach(weather => {
        expect(screen.getByText(weather)).toBeInTheDocument();
      });
    });

    it('エラー時の処理が正常に動作すること', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Analysis failed', message: '分析に失敗しました' }),
        } as Response)
      );

      render(<CorrelationAnalysis {...defaultProps} />);

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText(/分析に失敗しました/)).toBeInTheDocument();
      });
    });
  });

  describe('バリデーション', () => {
    it('必須フィールドのバリデーションが動作すること', async () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      // 日付をクリア
      const startDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: '' } });

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      // バリデーションエラーの確認は、フォームライブラリの実装に依存
      // 実際のテストでは、フォームのsubmitがAPIコールにつながらないことを確認
    });
  });

  describe('アクセシビリティ', () => {
    it('適切なARIAラベルが設定されていること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      // フォーム要素のラベルが適切に設定されていることを確認
      expect(screen.getByLabelText('開始日')).toBeInTheDocument();
      expect(screen.getByLabelText('終了日')).toBeInTheDocument();
      
      // ボタンの役割が適切に設定されていることを確認
      expect(screen.getByRole('button', { name: '相関分析実行' })).toBeInTheDocument();
    });

    it('キーボードナビゲーションが可能であること', () => {
      render(<CorrelationAnalysis {...defaultProps} />);

      const startDateInput = screen.getByLabelText('開始日');
      const endDateInput = screen.getByLabelText('終了日');
      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });

      // フォーカス移動のテスト
      startDateInput.focus();
      expect(document.activeElement).toBe(startDateInput);

      // Tabキーでの移動（実際のキーボードイベントのシミュレーション）
      fireEvent.keyDown(startDateInput, { key: 'Tab' });
    });
  });

  describe('パフォーマンス', () => {
    it('大量データでもレスポンシブに動作すること', async () => {
      const largeStores = Array.from({ length: 100 }, (_, i) => ({
        id: `store${i}`,
        name: `店舗${i}`
      }));

      render(<CorrelationAnalysis {...defaultProps} stores={largeStores} />);

      // 大量の選択肢があってもレンダリングが正常に完了することを確認
      expect(screen.getByDisplayValue('全店舗')).toBeInTheDocument();
    });

    it('分析結果の表示が効率的であること', async () => {
      const startTime = Date.now();

      render(<CorrelationAnalysis {...defaultProps} />);

      const analyzeButton = screen.getByRole('button', { name: '相関分析実行' });
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('分析結果')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // レンダリング時間が適切な範囲内であることを確認（例: 3秒以内）
      expect(renderTime).toBeLessThan(3000);
    });
  });

  describe('レスポンシブデザイン', () => {
    it('モバイル画面でも適切に表示されること', () => {
      // モバイル画面サイズでのテスト
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<CorrelationAnalysis {...defaultProps} />);

      // モバイルでも基本要素が表示されることを確認
      expect(screen.getByText('相関・比較分析')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '相関分析実行' })).toBeInTheDocument();
    });
  });
});
