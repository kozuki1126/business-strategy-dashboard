/**
 * エクスポートAPIエンドポイント
 * /api/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit';
import ExportService, { ExportFilters, ExportDataType, ExportFormat } from '@/lib/services/export';

// レート制限設定
const RATE_LIMIT = {
  maxRequests: 5, // 5回/時間
  windowMs: 60 * 60 * 1000 // 1時間
};

// リクエスト追跡用Map
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * POST /api/export - データエクスポート実行
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user = null;
  let exportStats = null;

  try {
    // 認証確認
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // レート制限チェック
    const rateLimitResult = checkRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      await AuditService.log({
        actor_id: user.id,
        action: 'export_rate_limited',
        target: 'export_api',
        metadata: {
          remainingTime: rateLimitResult.remainingTime,
          ipAddress: getClientIP(request)
        }
      });

      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `最大 ${RATE_LIMIT.maxRequests} 回/時間までエクスポート可能です`,
          remainingTime: rateLimitResult.remainingTime
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimitResult.remainingTime / 1000).toString()
          }
        }
      );
    }

    // リクエストボディ解析
    const body = await request.json();
    const { dataType, format, filters = {} } = body;

    // バリデーション
    const validation = validateExportRequest(dataType, format, filters);
    if (!validation.valid) {
      await AuditService.log({
        actor_id: user.id,
        action: 'export_validation_failed',
        target: 'export_api',
        metadata: {
          errors: validation.errors,
          requestData: { dataType, format, filters }
        }
      });

      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // エクスポート実行
    const exportService = new ExportService();
    const { result, stats } = await exportService.exportData(
      dataType,
      format,
      filters
    );

    exportStats = stats;

    // パフォーマンスSLA チェック (p95 ≤ 5s = 5000ms)
    const processingTime = Date.now() - startTime;
    const isWithinSLA = processingTime <= 5000;

    // 監査ログ記録
    await AuditService.log({
      actor_id: user.id,
      action: 'export_completed',
      target: 'export_api',
      metadata: {
        dataType,
        format,
        filters,
        stats: {
          ...stats,
          processingTime,
          withinSLA: isWithinSLA
        },
        filename: result.filename,
        fileSize: result.size,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'Unknown'
      }
    });

    // パフォーマンス警告
    if (!isWithinSLA) {
      console.warn(`Export SLA exceeded: ${processingTime}ms > 5000ms`, {
        userId: user.id,
        dataType,
        format,
        recordCount: stats.totalRecords
      });
    }

    // レスポンス
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
        'Content-Length': result.size.toString(),
        'X-Export-Stats': JSON.stringify({
          records: stats.totalRecords,
          processingTime,
          withinSLA: isWithinSLA
        }),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Export API error:', error);

    // エラー監査ログ
    if (user) {
      await AuditService.log({
        actor_id: user.id,
        action: 'export_failed',
        target: 'export_api',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime,
          exportStats,
          ipAddress: getClientIP(request)
        }
      });
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        error: 'Export failed',
        message: 'エクスポート処理中にエラーが発生しました',
        ...(isDevelopment && { details: error instanceof Error ? error.message : 'Unknown error' })
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export - エクスポート状況・制限情報取得
 */
export async function GET(request: NextRequest) {
  try {
    // 認証確認
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // レート制限状況
    const rateLimitStatus = getRateLimitStatus(user.id);

    // 監査ログ記録
    await AuditService.log({
      actor_id: user.id,
      action: 'export_status_check',
      target: 'export_api',
      metadata: {
        ipAddress: getClientIP(request)
      }
    });

    return NextResponse.json({
      rateLimit: {
        maxRequests: RATE_LIMIT.maxRequests,
        remainingRequests: rateLimitStatus.remaining,
        resetTime: rateLimitStatus.resetTime,
        windowMs: RATE_LIMIT.windowMs
      },
      supportedFormats: ['csv', 'excel'],
      supportedDataTypes: ['sales', 'external', 'combined'],
      maxFileSize: '50MB',
      maxPeriod: '1年',
      performanceSLA: '5秒以内'
    });

  } catch (error) {
    console.error('Export status API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get export status' },
      { status: 500 }
    );
  }
}

/**
 * エクスポートリクエスト検証
 */
function validateExportRequest(
  dataType: any,
  format: any,
  filters: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // データタイプ検証
  const validDataTypes: ExportDataType[] = ['sales', 'external', 'combined'];
  if (!dataType || !validDataTypes.includes(dataType)) {
    errors.push(`無効なデータタイプです。使用可能: ${validDataTypes.join(', ')}`);
  }

  // フォーマット検証
  const validFormats: ExportFormat[] = ['csv', 'excel'];
  if (!format || !validFormats.includes(format)) {
    errors.push(`無効なフォーマットです。使用可能: ${validFormats.join(', ')}`);
  }

  // フィルター検証
  if (filters) {
    const exportService = new ExportService();
    const filterValidation = exportService.validateFilters(filters);
    if (!filterValidation.valid) {
      errors.push(...filterValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * レート制限チェック
 */
function checkRateLimit(userId: string): { allowed: boolean; remainingTime: number } {
  const now = Date.now();
  const userKey = `export_${userId}`;
  const userLimit = requestCounts.get(userKey);

  if (!userLimit || now > userLimit.resetTime) {
    // 新しいウィンドウまたは期限切れ
    requestCounts.set(userKey, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    });
    return { allowed: true, remainingTime: 0 };
  }

  if (userLimit.count >= RATE_LIMIT.maxRequests) {
    // 制限超過
    return {
      allowed: false,
      remainingTime: userLimit.resetTime - now
    };
  }

  // リクエスト数増加
  userLimit.count++;
  requestCounts.set(userKey, userLimit);
  
  return { allowed: true, remainingTime: 0 };
}

/**
 * レート制限状況取得
 */
function getRateLimitStatus(userId: string): { remaining: number; resetTime: number } {
  const now = Date.now();
  const userKey = `export_${userId}`;
  const userLimit = requestCounts.get(userKey);

  if (!userLimit || now > userLimit.resetTime) {
    return {
      remaining: RATE_LIMIT.maxRequests,
      resetTime: now + RATE_LIMIT.windowMs
    };
  }

  return {
    remaining: Math.max(0, RATE_LIMIT.maxRequests - userLimit.count),
    resetTime: userLimit.resetTime
  };
}

/**
 * クライアントIP取得
 */
function getClientIP(request: NextRequest): string {
  // Vercel環境での実際のIP取得
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }

  // フォールバック
  return request.headers.get('x-forwarded-for') ||
         request.headers.get('remote-addr') ||
         'unknown';
}

// 定期的なメモリクリーンアップ（1時間ごと）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60 * 60 * 1000);
