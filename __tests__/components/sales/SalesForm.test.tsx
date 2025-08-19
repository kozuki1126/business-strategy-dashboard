import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesForm } from '@/components/sales/SalesForm';
import { createClient } from '@/lib/supabase/client';

// Supabase mock
jest.mock('@/lib/supabase/client');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Next.js router mock
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Fetch mock
global.fetch = jest.fn();

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  auth: {
    getUser: jest.fn(),
  },
};

describe('SalesForm', () => {
  beforeEach(() => {
    mockCreateClient.mockReturnValue(mockSupabaseClient as any);
    
    // 店舗データのモック
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            { id: 'store-1', name: '新宿店', area: '東京' },
            { id: 'store-2', name: '大阪店', area: '関西' },
          ],
          error: null,
        }),
      }),
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: { id: 'sales-1' },
        success: true,
        message: 'Success',
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render form fields correctly', async () => {
    render(<SalesForm />);

    // 必須フィールドの確認
    expect(screen.getByLabelText(/日付/)).toBeInTheDocument();
    expect(screen.getByLabelText(/店舗/)).toBeInTheDocument();
    expect(screen.getByLabelText(/部門/)).toBeInTheDocument();
    expect(screen.getByLabelText(/商品カテゴリ/)).toBeInTheDocument();
    expect(screen.getByLabelText(/税抜売上/)).toBeInTheDocument();

    // オプションフィールドの確認
    expect(screen.getByLabelText(/客数/)).toBeInTheDocument();
    expect(screen.getByLabelText(/取引数/)).toBeInTheDocument();
    expect(screen.getByLabelText(/割引額/)).toBeInTheDocument();
    expect(screen.getByLabelText(/備考/)).toBeInTheDocument();

    // ボタンの確認
    expect(screen.getByRole('button', { name: /売上を保存/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /キャンセル/ })).toBeInTheDocument();
  });

  it('should load store options', async () => {
    render(<SalesForm />);

    await waitFor(() => {
      const storeSelect = screen.getByLabelText(/店舗/);
      expect(storeSelect).toBeInTheDocument();
    });

    // 店舗データが読み込まれることを確認
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('dim_store');
  });

  it('should show validation errors for required fields', async () => {
    const user = userEvent.setup();
    render(<SalesForm />);

    // 必須フィールドを空のままフォーム送信
    const submitButton = screen.getByRole('button', { name: /売上を保存/ });
    await user.click(submitButton);

    // バリデーションエラーが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/店舗を選択してください/)).toBeInTheDocument();
      expect(screen.getByText(/部門を選択してください/)).toBeInTheDocument();
      expect(screen.getByText(/商品カテゴリを選択してください/)).toBeInTheDocument();
    });
  });

  it('should handle form input changes', async () => {
    const user = userEvent.setup();
    render(<SalesForm />);

    // 日付の変更
    const dateInput = screen.getByLabelText(/日付/) as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2025-08-19');
    expect(dateInput.value).toBe('2025-08-19');

    // 売上金額の変更
    const revenueInput = screen.getByLabelText(/税抜売上/) as HTMLInputElement;
    await user.clear(revenueInput);
    await user.type(revenueInput, '100000');
    expect(revenueInput.value).toBe('100000');

    // 客数の変更
    const footfallInput = screen.getByLabelText(/客数/) as HTMLInputElement;
    await user.clear(footfallInput);
    await user.type(footfallInput, '50');
    expect(footfallInput.value).toBe('50');
  });

  it('should show calculation results when revenue is entered', async () => {
    const user = userEvent.setup();
    render(<SalesForm />);

    // 売上金額を入力
    const revenueInput = screen.getByLabelText(/税抜売上/);
    await user.clear(revenueInput);
    await user.type(revenueInput, '100000');

    // 計算結果セクションが表示されることを確認
    expect(screen.getByText(/計算結果/)).toBeInTheDocument();
    
    // 表示ボタンをクリック
    const showButton = screen.getByRole('button', { name: /表示/ });
    await user.click(showButton);

    // 税込売上が表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/税込売上/)).toBeInTheDocument();
    });
  });

  it('should calculate metrics correctly', async () => {
    const user = userEvent.setup();
    render(<SalesForm />);

    // 売上、客数、取引数を入力
    const revenueInput = screen.getByLabelText(/税抜売上/);
    await user.clear(revenueInput);
    await user.type(revenueInput, '100000');

    const footfallInput = screen.getByLabelText(/客数/);
    await user.clear(footfallInput);
    await user.type(footfallInput, '100');

    const transactionsInput = screen.getByLabelText(/取引数/);
    await user.clear(transactionsInput);
    await user.type(transactionsInput, '50');

    // 計算結果を表示
    const showButton = screen.getByRole('button', { name: /表示/ });
    await user.click(showButton);

    await waitFor(() => {
      // 客単価: 100000 / 50 = 2000円
      expect(screen.getByText(/￥2,000/)).toBeInTheDocument();
      
      // 転換率: 50 / 100 * 100 = 50%
      expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    
    render(<SalesForm onSuccess={onSuccess} />);

    // フォームに有効なデータを入力
    await user.type(screen.getByLabelText(/日付/), '2025-08-19');
    
    // 店舗選択（selectタグなのでfireEventを使用）
    fireEvent.change(screen.getByLabelText(/店舗/), { target: { value: 'store-1' } });
    fireEvent.change(screen.getByLabelText(/部門/), { target: { value: 'electronics' } });
    fireEvent.change(screen.getByLabelText(/商品カテゴリ/), { target: { value: 'premium' } });
    
    await user.clear(screen.getByLabelText(/税抜売上/));
    await user.type(screen.getByLabelText(/税抜売上/), '100000');

    // フォーム送信
    const submitButton = screen.getByRole('button', { name: /売上を保存/ });
    await user.click(submitButton);

    // API呼び出しが実行されることを確認
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('100000'),
      });
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // APIエラーのモック
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({
        data: null,
        success: false,
        message: 'API Error',
      }),
    });

    render(<SalesForm />);

    // 有効なデータを入力
    fireEvent.change(screen.getByLabelText(/店舗/), { target: { value: 'store-1' } });
    fireEvent.change(screen.getByLabelText(/部門/), { target: { value: 'electronics' } });
    fireEvent.change(screen.getByLabelText(/商品カテゴリ/), { target: { value: 'premium' } });
    await user.type(screen.getByLabelText(/税抜売上/), '100000');

    // フォーム送信
    const submitButton = screen.getByRole('button', { name: /売上を保存/ });
    await user.click(submitButton);

    // エラーメッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/API Error/)).toBeInTheDocument();
    });
  });

  it('should validate business logic constraints', async () => {
    const user = userEvent.setup();
    render(<SalesForm />);

    // 取引数 > 客数になるデータを入力
    await user.type(screen.getByLabelText(/客数/), '50');
    await user.type(screen.getByLabelText(/取引数/), '100');

    // 取引数フィールドからフォーカスを外す（バリデーション実行のため）
    fireEvent.blur(screen.getByLabelText(/取引数/));

    // バリデーションエラーが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/取引数は客数以下である必要があります/)).toBeInTheDocument();
    });
  });

  it('should initialize with provided initial data', () => {
    const initialData = {
      date: '2025-08-18',
      store_id: 'store-1',
      department: 'electronics',
      revenue_ex_tax: 50000,
    };

    render(<SalesForm initialData={initialData} />);

    // 初期データが設定されていることを確認
    expect((screen.getByLabelText(/日付/) as HTMLInputElement).value).toBe('2025-08-18');
    expect((screen.getByLabelText(/税抜売上/) as HTMLInputElement).value).toBe('50000');
  });
});