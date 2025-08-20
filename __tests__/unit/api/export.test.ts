/**
 * Export API エンドポイントテスト
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/export/route';
import { getCurrentUser } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit';
import ExportService from '@/lib/services/export';

// モック設定
jest.mock('@/lib/auth');
jest.mock('@/lib/services/audit');
jest.mock('@/lib/services/export');

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockAuditService = AuditService as jest.Mocked<typeof AuditService>;
const MockExportService = ExportService as jest.MockedClass<typeof ExportService>;

describe('/api/export', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService.log = jest.fn().mockResolvedValue(undefined);
  });

  describe('POST /api/export', () => {
    it('should successfully export CSV data', async () => {
      // モック設定
      mockGetCurrentUser.mockResolvedValue(mockUser);
      
      const mockExportResult = {
        result: {
          filename: 'sales_export_20250820_120000.csv',
          buffer: Buffer.from('header1,header2\nvalue1,value2'),
          mimeType: 'text/csv; charset=utf-8',
          size: 1000
        },
        stats: {
          totalRecords: 100,
          filteredRecords: 100,
          generationTime: 2000,
          fileSize: 1000
        }
      };

      MockExportService.prototype.exportData = jest.fn().mockResolvedValue(mockExportResult);
      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      // リクエスト作成
      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv',
          filters: {
            startDate: '2025-01-01',
            endDate: '2025-01-31'
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // API実行
      const response = await POST(request);

      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Length')).toBe('1000');

      // 監査ログ確認
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: mockUser.id,
          action: 'export_completed',
          target: 'export_api'
        })
      );
    });

    it('should successfully export Excel data', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const mockExportResult = {
        result: {
          filename: 'external_export_20250820_120000.xlsx',
          buffer: Buffer.from('mock excel data'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 2000
        },
        stats: {
          totalRecords: 50,
          filteredRecords: 50,
          generationTime: 3000,
          fileSize: 2000
        }
      };

      MockExportService.prototype.exportData = jest.fn().mockResolvedValue(mockExportResult);
      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'external',
          format: 'excel',
          filters: {}
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers.get('X-Export-Stats')).toContain('"records":50');
    });

    it('should return 401 for unauthenticated users', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for invalid data type', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'invalid',
          format: 'csv'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.errors).toContain('無効なデータタイプです。使用可能: sales, external, combined');

      // バリデーション失敗の監査ログ
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'export_validation_failed'
        })
      );
    });

    it('should return 400 for invalid format', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'pdf'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
      expect(data.errors).toContain('無効なフォーマットです。使用可能: csv, excel');
    });

    it('should return 400 for invalid filters', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      
      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: false,
        errors: ['開始日は終了日より前である必要があります']
      });

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv',
          filters: {
            startDate: '2025-01-31',
            endDate: '2025-01-01'
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.errors).toContain('開始日は終了日より前である必要があります');
    });

    it('should handle rate limiting', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      // 6回連続でリクエストしてレート制限をテスト
      const requests = Array(6).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/export', {
          method: 'POST',
          body: JSON.stringify({
            dataType: 'sales',
            format: 'csv'
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      MockExportService.prototype.exportData = jest.fn().mockResolvedValue({
        result: {
          filename: 'test.csv',
          buffer: Buffer.from('test'),
          mimeType: 'text/csv',
          size: 100
        },
        stats: {
          totalRecords: 1,
          filteredRecords: 1,
          generationTime: 100,
          fileSize: 100
        }
      });

      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      // 5回は成功するはず
      for (let i = 0; i < 5; i++) {
        const response = await POST(requests[i]);
        expect(response.status).toBe(200);
      }

      // 6回目はレート制限にひっかかるはず
      const lastResponse = await POST(requests[5]);
      expect(lastResponse.status).toBe(429);

      const data = await lastResponse.json();
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.message).toContain('最大 5 回/時間までエクスポート可能です');
    });

    it('should return 500 for export errors', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      
      MockExportService.prototype.exportData = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );
      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Export failed');
      expect(data.message).toBe('エクスポート処理中にエラーが発生しました');

      // エラー監査ログ
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'export_failed'
        })
      );
    });

    it('should warn for SLA violations', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      
      // 長い処理時間をシミュレート
      MockExportService.prototype.exportData = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          result: {
            filename: 'slow_export.csv',
            buffer: Buffer.from('data'),
            mimeType: 'text/csv',
            size: 100
          },
          stats: {
            totalRecords: 1000000,
            filteredRecords: 1000000,
            generationTime: 6000, // 6秒 (SLA 5秒を超過)
            fileSize: 100
          }
        };
      });

      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      
      // SLA違反の警告が出ているか確認
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export SLA exceeded'),
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('GET /api/export', () => {
    it('should return export status and configuration', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        rateLimit: expect.objectContaining({
          maxRequests: 5,
          remainingRequests: expect.any(Number),
          resetTime: expect.any(Number),
          windowMs: 3600000
        }),
        supportedFormats: ['csv', 'excel'],
        supportedDataTypes: ['sales', 'external', 'combined'],
        maxFileSize: '50MB',
        maxPeriod: '1年',
        performanceSLA: '5秒以内'
      });

      // ステータス確認の監査ログ
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'export_status_check'
        })
      );
    });

    it('should return 401 for unauthenticated users', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle status check errors', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockAuditService.log.mockRejectedValue(new Error('Audit service error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get export status');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Request parsing', () => {
    it('should handle malformed JSON', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: 'invalid json{',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle missing request body', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('IP address extraction', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      MockExportService.prototype.exportData = jest.fn().mockResolvedValue({
        result: {
          filename: 'test.csv',
          buffer: Buffer.from('test'),
          mimeType: 'text/csv',
          size: 100
        },
        stats: {
          totalRecords: 1,
          filteredRecords: 1,
          generationTime: 100,
          fileSize: 100
        }
      });

      MockExportService.prototype.validateFilters = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });

      const request = new NextRequest('http://localhost:3000/api/export', {
        method: 'POST',
        body: JSON.stringify({
          dataType: 'sales',
          format: 'csv'
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1, 10.0.0.1'
        }
      });

      await POST(request);

      // IPアドレスが監査ログに記録されているか確認
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ipAddress: '192.168.1.1'
          })
        })
      );
    });
  });
});
