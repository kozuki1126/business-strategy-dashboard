/**
 * 相関分析APIエンドポイント
 * /api/analytics/correlation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit';
import CorrelationService, { CorrelationFilters } from '@/lib/services/correlation';

// パフォーマンス要件
const CORRELATION_SLA_MS = 5000; // p95 ≤ 5秒

/**
 * POST /api/analytics/correlation - 相関分析実行
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user = null;
  let analysisStats = null;

  try {
    // 認証確認
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // リクエストボディ解析
    const body = await request.json();
    const { filters } = body;

    // バリデーション
    const validation = validateCorrelationRequest(filters);
    if (!validation.valid) {
      await AuditService.log({
        actor_id: user.id,
        action: 'correlation_validation_failed',
        target: 'correlation_api',
        metadata: {
          errors: validation.errors,
          requestData: filters
        }
      });

      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // 相関分析実行
    const correlationService = new CorrelationService();
    const result = await correlationService.analyzeCorrelations(filters);

    // パフォーマンスSLA チェック (p95 ≤ 5s = 5000ms)
    const processingTime = Date.now() - startTime;
    const isWithinSLA = processingTime <= CORRELATION_SLA_MS;

    analysisStats = {
      processingTime,
      dataPoints: result.comparisonData.length,
      correlationCount: result.correlations.length,
      withinSLA: isWithinSLA
    };

    // 監査ログ記録
    await AuditService.log({
      actor_id: user.id,
      action: 'correlation_analysis_completed',
      target: 'correlation_api',
      metadata: {
        filters,
        stats: analysisStats,
        summary: {
          totalAnalyzedDays: result.summary.totalAnalyzedDays,
          averageDailySales: result.summary.averageDailySales,
          strongestPositive: result.summary.strongestPositive?.factor,
          strongestNegative: result.summary.strongestNegative?.factor
        },
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'Unknown'
      }
    });

    // パフォーマンス警告
    if (!isWithinSLA) {
      console.warn(`Correlation analysis SLA exceeded: ${processingTime}ms > ${CORRELATION_SLA_MS}ms`, {
        userId: user.id,
        filters,
        dataPoints: result.comparisonData.length
      });
    }

    // レスポンス
    return NextResponse.json({
      data: result,
      meta: {
        processingTime,
        withinSLA: isWithinSLA,
        timestamp: new Date().toISOString(),
        userId: user.id,
        filtersApplied: filters
      }
    });

  } catch (error) {
    console.error('Correlation analysis API error:', error);

    // エラー監査ログ
    if (user) {
      await AuditService.log({
        actor_id: user.id,
        action: 'correlation_analysis_failed',
        target: 'correlation_api',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime,
          analysisStats,
          ipAddress: getClientIP(request)
        }
      });
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        error: 'Correlation analysis failed',
        message: '相関分析処理中にエラーが発生しました',
        ...(isDevelopment && { details: error instanceof Error ? error.message : 'Unknown error' })
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/correlation - 相関分析設定・制限情報取得
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

    // 監査ログ記録
    await AuditService.log({
      actor_id: user.id,
      action: 'correlation_config_check',
      target: 'correlation_api',
      metadata: {
        ipAddress: getClientIP(request)
      }
    });

    return NextResponse.json({
      config: {
        maxAnalysisPeriod: '1年',
        performanceSLA: `${CORRELATION_SLA_MS / 1000}秒以内`,
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
      },
      limits: {
        maxDataPoints: 10000,
        minAnalysisPeriod: '7日',
        maxConcurrentRequests: 3
      },
      features: {
        realTimeAnalysis: true,
        heatmapVisualization: true,
        exportSupport: true,
        comparisonAnalysis: true
      }
    });

  } catch (error) {
    console.error('Correlation config API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get correlation configuration' },
      { status: 500 }
    );
  }
}

/**
 * 相関分析リクエスト検証
 */
function validateCorrelationRequest(filters: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 必須フィールドチェック
  if (!filters) {
    errors.push('フィルター情報が必要です');
    return { valid: false, errors };
  }

  if (!filters.startDate) {
    errors.push('開始日が必要です');
  }

  if (!filters.endDate) {
    errors.push('終了日が必要です');
  }

  if (filters.startDate && filters.endDate) {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    // 日付妥当性チェック
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push('無効な日付形式です');
    } else {
      // 期間チェック
      if (startDate > endDate) {
        errors.push('開始日は終了日より前である必要があります');
      }

      // 最大期間制限（1年）
      const maxPeriod = 365 * 24 * 60 * 60 * 1000; // 1年
      if (endDate.getTime() - startDate.getTime() > maxPeriod) {
        errors.push('分析期間は最大1年間です');
      }

      // 最小期間制限（7日）
      const minPeriod = 7 * 24 * 60 * 60 * 1000; // 7日
      if (endDate.getTime() - startDate.getTime() < minPeriod) {
        errors.push('分析期間は最低7日間必要です');
      }
    }
  }

  // オプションフィールドのバリデーション
  if (filters.storeId && typeof filters.storeId !== 'string') {
    errors.push('店舗IDは文字列である必要があります');
  }

  if (filters.department && typeof filters.department !== 'string') {
    errors.push('部門は文字列である必要があります');
  }

  if (filters.category && typeof filters.category !== 'string') {
    errors.push('カテゴリは文字列である必要があります');
  }

  return {
    valid: errors.length === 0,
    errors
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
