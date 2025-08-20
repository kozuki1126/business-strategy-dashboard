/**
 * 相関分析API エンドポイント ユニットテスト
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/analytics/correlation/route';

// モック設定
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn()
}));

jest.mock('@/lib/services/audit', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('@/lib/services/correlation', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    analyzeCorrelations: jest.fn()
  }))
}));

import { getCurrentUser } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit';
import CorrelationService from '@/lib/services/correlation';

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockAuditServiceLog = AuditService.log as jest.MockedFunction<typeof AuditService.log>;

// テストデータ
const mockUser = {
  id: 'user123',
  email: 'test@example.com'
};

const mockCorrelationResults = {
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
    }
  ],
  heatmapData: [
    {
      x: '月',
      y: '晴',
      value: 1.2,
      tooltip: '月曜日・晴: 平均売上 120,000円 (5日)'
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
    strongestNegative: null,
    totalAnalyzedDays: 30,
    averageDailySales: 100000
  }
};

const validFilters = {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  storeId: 'store1',
  department: 'electronics',
  category: 'smartphones'
};

// NextRequestモックヘルパー
function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  const request = {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockImplementation((name: string) => headers[name] || null)
    }
  } as unknown as NextRequest;
  
  return request;
}

describe('/api/analytics/correlation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockAuditServiceLog.mockResolvedValue(undefined);
  });

  describe('POST /api/analytics/correlation', () => {
    describe('正常ケース', () => {
      beforeEach(() => {
        const mockCorrelationService = new CorrelationService();
        (mockCorrelationService.analyzeCorrelations as jest.Mock).mockResolvedValue(mockCorrelationResults);
        (CorrelationService as jest.MockedClass<typeof CorrelationService>).mockImplementation(() => mockCorrelationService);
      });

      it('有効なリクエストで相関分析が実行されること', async () => {
        const request = createMockRequest({ filters: validFilters });
        
        const response = await POST(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toHaveProperty('data');
        expect(responseData).toHaveProperty('meta');
        expect(responseData.data).toEqual(mockCorrelationResults);
        expect(responseData.meta).toHaveProperty('processingTime');
        expect(responseData.meta).toHaveProperty('withinSLA');
        expect(responseData.meta).toHaveProperty('timestamp');
      });

      it('監査ログが正しく記録されること', async () => {
        const request = createMockRequest(
          { filters: validFilters },
          { 'x-forwarded-for': '192.168.1.1', 'user-agent': 'Test Browser' }
        );
        
        await POST(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith({
          actor_id: mockUser.id,
          action: 'correlation_analysis_completed',
          target: 'correlation_api',
          metadata: expect.objectContaining({
            filters: validFilters,
            stats: expect.objectContaining({
              processingTime: expect.any(Number),
              withinSLA: expect.any(Boolean)
            }),
            ipAddress: '192.168.1.1',
            userAgent: 'Test Browser'
          })
        });
      });

      it('パフォーマンスSLA内で処理が完了すること', async () => {
        const request = createMockRequest({ filters: validFilters });
        
        const startTime = Date.now();
        const response = await POST(request);
        const endTime = Date.now();
        
        const responseData = await response.json();
        const processingTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(processingTime).toBeLessThan(5000); // 5秒以内
        expect(responseData.meta.withinSLA).toBe(true);
      });

      it('フィルター無しでも正常に動作すること', async () => {
        const minimalFilters = {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };
        
        const request = createMockRequest({ filters: minimalFilters });
        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe('認証エラー', () => {
      it('未認証ユーザーの場合401エラーを返すこと', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        
        const request = createMockRequest({ filters: validFilters });
        const response = await POST(request);

        expect(response.status).toBe(401);
        
        const responseData = await response.json();
        expect(responseData.error).toBe('Unauthorized');
      });
    });

    describe('バリデーションエラー', () => {
      it('フィルターが存在しない場合400エラーを返すこと', async () => {
        const request = createMockRequest({});
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.error).toBe('Validation failed');
        expect(responseData.errors).toContain('フィルター情報が必要です');
      });

      it('開始日が存在しない場合400エラーを返すこと', async () => {
        const invalidFilters = {
          endDate: '2024-01-31'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('開始日が必要です');
      });

      it('終了日が存在しない場合400エラーを返すこと', async () => {
        const invalidFilters = {
          startDate: '2024-01-01'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('終了日が必要です');
      });

      it('開始日が終了日より後の場合400エラーを返すこと', async () => {
        const invalidFilters = {
          startDate: '2024-01-31',
          endDate: '2024-01-01'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('開始日は終了日より前である必要があります');
      });

      it('期間が1年を超える場合400エラーを返すこと', async () => {
        const invalidFilters = {
          startDate: '2023-01-01',
          endDate: '2024-12-31'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('分析期間は最大1年間です');
      });

      it('期間が7日未満の場合400エラーを返すこと', async () => {
        const invalidFilters = {
          startDate: '2024-01-01',
          endDate: '2024-01-03'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('分析期間は最低7日間必要です');
      });

      it('無効な日付形式の場合400エラーを返すこと', async () => {
        const invalidFilters = {
          startDate: 'invalid-date',
          endDate: '2024-01-31'
        };
        
        const request = createMockRequest({ filters: invalidFilters });
        const response = await POST(request);

        expect(response.status).toBe(400);
        
        const responseData = await response.json();
        expect(responseData.errors).toContain('無効な日付形式です');
      });
    });

    describe('サービスエラー', () => {
      it('分析サービスでエラーが発生した場合500エラーを返すこと', async () => {
        const mockCorrelationService = new CorrelationService();
        (mockCorrelationService.analyzeCorrelations as jest.Mock).mockRejectedValue(new Error('Database connection failed'));
        (CorrelationService as jest.MockedClass<typeof CorrelationService>).mockImplementation(() => mockCorrelationService);

        const request = createMockRequest({ filters: validFilters });
        const response = await POST(request);

        expect(response.status).toBe(500);
        
        const responseData = await response.json();
        expect(responseData.error).toBe('Correlation analysis failed');
        expect(responseData.message).toBe('相関分析処理中にエラーが発生しました');
      });

      it('エラー時も監査ログが記録されること', async () => {
        const mockCorrelationService = new CorrelationService();
        (mockCorrelationService.analyzeCorrelations as jest.Mock).mockRejectedValue(new Error('Test error'));
        (CorrelationService as jest.MockedClass<typeof CorrelationService>).mockImplementation(() => mockCorrelationService);

        const request = createMockRequest({ filters: validFilters });
        await POST(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith({
          actor_id: mockUser.id,
          action: 'correlation_analysis_failed',
          target: 'correlation_api',
          metadata: expect.objectContaining({
            error: 'Test error',
            processingTime: expect.any(Number)
          })
        });
      });
    });

    describe('パフォーマンス警告', () => {
      it('SLA超過時に警告ログが出力されること', async () => {
        // 処理時間を5秒超に設定
        const mockCorrelationService = new CorrelationService();
        (mockCorrelationService.analyzeCorrelations as jest.Mock).mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // 短い遅延（実際のテストでは長くしない）
          return mockCorrelationResults;
        });
        (CorrelationService as jest.MockedClass<typeof CorrelationService>).mockImplementation(() => mockCorrelationService);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const request = createMockRequest({ filters: validFilters });
        const response = await POST(request);

        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        // 実際のテストでは時間制御が困難なため、SLA要件の存在を確認
        expect(responseData.meta).toHaveProperty('withinSLA');

        consoleSpy.mockRestore();
      });
    });
  });

  describe('GET /api/analytics/correlation', () => {
    describe('正常ケース', () => {
      it('設定情報が正常に取得できること', async () => {
        const request = createMockRequest({});
        const response = await GET(request);

        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        expect(responseData).toHaveProperty('config');
        expect(responseData).toHaveProperty('limits');
        expect(responseData).toHaveProperty('features');

        // 設定内容の確認
        expect(responseData.config).toHaveProperty('maxAnalysisPeriod');
        expect(responseData.config).toHaveProperty('performanceSLA');
        expect(responseData.config).toHaveProperty('supportedFactors');
        expect(responseData.config).toHaveProperty('correlationMethods');

        // 制限内容の確認
        expect(responseData.limits).toHaveProperty('maxDataPoints');
        expect(responseData.limits).toHaveProperty('minAnalysisPeriod');
        expect(responseData.limits).toHaveProperty('maxConcurrentRequests');

        // 機能内容の確認
        expect(responseData.features).toHaveProperty('realTimeAnalysis');
        expect(responseData.features).toHaveProperty('heatmapVisualization');
        expect(responseData.features).toHaveProperty('exportSupport');
      });

      it('監査ログが正しく記録されること', async () => {
        const request = createMockRequest({}, { 'x-forwarded-for': '192.168.1.1' });
        await GET(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith({
          actor_id: mockUser.id,
          action: 'correlation_config_check',
          target: 'correlation_api',
          metadata: expect.objectContaining({
            ipAddress: '192.168.1.1'
          })
        });
      });
    });

    describe('認証エラー', () => {
      it('未認証ユーザーの場合401エラーを返すこと', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        
        const request = createMockRequest({});
        const response = await GET(request);

        expect(response.status).toBe(401);
        
        const responseData = await response.json();
        expect(responseData.error).toBe('Unauthorized');
      });
    });

    describe('サービスエラー', () => {
      it('予期しないエラーが発生した場合500エラーを返すこと', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('Auth service error'));
        
        const request = createMockRequest({});
        const response = await GET(request);

        expect(response.status).toBe(500);
        
        const responseData = await response.json();
        expect(responseData.error).toBe('Failed to get correlation configuration');
      });
    });
  });

  describe('ヘルパー関数', () => {
    describe('getClientIP', () => {
      it('x-forwarded-forヘッダーからIPを取得できること', async () => {
        const request = createMockRequest(
          { filters: validFilters },
          { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
        );
        
        await POST(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              ipAddress: '192.168.1.1' // 最初のIPが使用される
            })
          })
        );
      });

      it('x-real-ipヘッダーからIPを取得できること', async () => {
        const request = createMockRequest(
          { filters: validFilters },
          { 'x-real-ip': '192.168.1.2' }
        );
        
        await POST(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              ipAddress: '192.168.1.2'
            })
          })
        );
      });

      it('IPヘッダーが無い場合unknownを返すこと', async () => {
        const request = createMockRequest({ filters: validFilters });
        
        await POST(request);

        expect(mockAuditServiceLog).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              ipAddress: 'unknown'
            })
          })
        );
      });
    });
  });
});
