/**
 * SLO Monitoring and Load Testing System
 * Task #014: 性能・p95最適化実装
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { performance } from 'perf_hooks'

// SLO定義
export const SLO_TARGETS = {
  AVAILABILITY: 0.995, // 99.5%
  P95_RESPONSE_TIME: 1500, // 1500ms
  MAX_CONCURRENT_USERS: 100,
  ERROR_RATE_THRESHOLD: 0.01, // 1%
  THROUGHPUT_TARGET: 50 // requests/second
} as const

// メトリクス収集
interface SLOMetrics {
  timestamp: number
  responseTime: number
  success: boolean
  endpoint: string
  concurrentUsers: number
  errorType?: string
  userId?: string
  region?: string
}

class SLOMonitor {
  private metrics: SLOMetrics[] = []
  private alertCallbacks: ((alert: SLOAlert) => void)[] = []
  private monitoringInterval?: NodeJS.Timeout
  
  constructor() {
    this.startMonitoring()
  }

  /**
   * メトリクス記録
   */
  recordMetric(metric: Omit<SLOMetrics, 'timestamp'>) {
    const fullMetric: SLOMetrics = {
      ...metric,
      timestamp: Date.now()
    }
    
    this.metrics.push(fullMetric)
    
    // メモリ制限（直近1時間のデータのみ保持）
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo)
    
    // リアルタイムSLO評価
    this.evaluateSLO(fullMetric)
  }

  /**
   * リアルタイムSLO評価
   */
  private evaluateSLO(newMetric: SLOMetrics) {
    const recent = this.getRecentMetrics(5 * 60 * 1000) // 直近5分
    
    if (recent.length < 10) return // 最小サンプル数
    
    const availability = this.calculateAvailability(recent)
    const p95ResponseTime = this.calculateP95ResponseTime(recent)
    const errorRate = this.calculateErrorRate(recent)
    const avgConcurrentUsers = recent.reduce((acc, m) => acc + m.concurrentUsers, 0) / recent.length
    
    // SLO違反チェック
    const violations: SLOViolation[] = []
    
    if (availability < SLO_TARGETS.AVAILABILITY) {
      violations.push({
        type: 'availability',
        target: SLO_TARGETS.AVAILABILITY,
        actual: availability,
        severity: availability < 0.99 ? 'critical' : 'warning'
      })
    }
    
    if (p95ResponseTime > SLO_TARGETS.P95_RESPONSE_TIME) {
      violations.push({
        type: 'response_time',
        target: SLO_TARGETS.P95_RESPONSE_TIME,
        actual: p95ResponseTime,
        severity: p95ResponseTime > 3000 ? 'critical' : 'warning'
      })
    }
    
    if (errorRate > SLO_TARGETS.ERROR_RATE_THRESHOLD) {
      violations.push({
        type: 'error_rate',
        target: SLO_TARGETS.ERROR_RATE_THRESHOLD,
        actual: errorRate,
        severity: errorRate > 0.05 ? 'critical' : 'warning'
      })
    }
    
    if (avgConcurrentUsers > SLO_TARGETS.MAX_CONCURRENT_USERS) {
      violations.push({
        type: 'concurrent_users',
        target: SLO_TARGETS.MAX_CONCURRENT_USERS,
        actual: avgConcurrentUsers,
        severity: avgConcurrentUsers > 150 ? 'critical' : 'warning'
      })
    }
    
    // アラート送信
    if (violations.length > 0) {
      this.sendAlert({
        timestamp: Date.now(),
        violations,
        context: {
          totalMetrics: recent.length,
          timeWindow: '5min',
          currentMetric: newMetric
        }
      })
    }
  }

  /**
   * 可用性計算
   */
  private calculateAvailability(metrics: SLOMetrics[]): number {
    const total = metrics.length
    const successful = metrics.filter(m => m.success).length
    return total > 0 ? successful / total : 1
  }

  /**
   * P95応答時間計算
   */
  private calculateP95ResponseTime(metrics: SLOMetrics[]): number {
    const responseTimes = metrics
      .filter(m => m.success)
      .map(m => m.responseTime)
      .sort((a, b) => a - b)
    
    if (responseTimes.length === 0) return 0
    
    const p95Index = Math.ceil(responseTimes.length * 0.95) - 1
    return responseTimes[p95Index] || 0
  }

  /**
   * エラー率計算
   */
  private calculateErrorRate(metrics: SLOMetrics[]): number {
    const total = metrics.length
    const errors = metrics.filter(m => !m.success).length
    return total > 0 ? errors / total : 0
  }

  /**
   * 期間内メトリクス取得
   */
  private getRecentMetrics(windowMs: number): SLOMetrics[] {
    const cutoff = Date.now() - windowMs
    return this.metrics.filter(m => m.timestamp > cutoff)
  }

  /**
   * SLOサマリーレポート生成
   */
  generateSLOReport(periodMs: number = 24 * 60 * 60 * 1000): SLOReport {
    const metrics = this.getRecentMetrics(periodMs)
    
    if (metrics.length === 0) {
      return {
        period: '24h',
        timestamp: Date.now(),
        availability: { target: SLO_TARGETS.AVAILABILITY, actual: 1, status: 'healthy' },
        responseTime: { target: SLO_TARGETS.P95_RESPONSE_TIME, actual: 0, status: 'healthy' },
        errorRate: { target: SLO_TARGETS.ERROR_RATE_THRESHOLD, actual: 0, status: 'healthy' },
        concurrentUsers: { target: SLO_TARGETS.MAX_CONCURRENT_USERS, actual: 0, status: 'healthy' },
        totalRequests: 0,
        endpoints: {},
        recommendations: []
      }
    }

    const availability = this.calculateAvailability(metrics)
    const p95ResponseTime = this.calculateP95ResponseTime(metrics)
    const errorRate = this.calculateErrorRate(metrics)
    const maxConcurrentUsers = Math.max(...metrics.map(m => m.concurrentUsers))
    
    // エンドポイント別統計
    const endpointStats: Record<string, EndpointStats> = {}
    metrics.forEach(m => {
      if (!endpointStats[m.endpoint]) {
        endpointStats[m.endpoint] = {
          requests: 0,
          errors: 0,
          totalResponseTime: 0,
          maxResponseTime: 0,
          minResponseTime: Infinity
        }
      }
      
      const stat = endpointStats[m.endpoint]
      stat.requests++
      if (!m.success) stat.errors++
      stat.totalResponseTime += m.responseTime
      stat.maxResponseTime = Math.max(stat.maxResponseTime, m.responseTime)
      stat.minResponseTime = Math.min(stat.minResponseTime, m.responseTime)
    })

    // 改善提案生成
    const recommendations: string[] = []
    if (availability < SLO_TARGETS.AVAILABILITY) {
      recommendations.push('可用性改善: エラーハンドリング強化、冗長化検討')
    }
    if (p95ResponseTime > SLO_TARGETS.P95_RESPONSE_TIME) {
      recommendations.push('応答時間改善: キャッシュ最適化、クエリ最適化、CDN活用')
    }
    if (errorRate > SLO_TARGETS.ERROR_RATE_THRESHOLD) {
      recommendations.push('エラー率改善: バリデーション強化、リトライロジック追加')
    }
    if (maxConcurrentUsers > SLO_TARGETS.MAX_CONCURRENT_USERS * 0.8) {
      recommendations.push('スケーリング検討: 負荷分散、オートスケーリング設定')
    }

    return {
      period: '24h',
      timestamp: Date.now(),
      availability: {
        target: SLO_TARGETS.AVAILABILITY,
        actual: availability,
        status: availability >= SLO_TARGETS.AVAILABILITY ? 'healthy' : 'violation'
      },
      responseTime: {
        target: SLO_TARGETS.P95_RESPONSE_TIME,
        actual: p95ResponseTime,
        status: p95ResponseTime <= SLO_TARGETS.P95_RESPONSE_TIME ? 'healthy' : 'violation'
      },
      errorRate: {
        target: SLO_TARGETS.ERROR_RATE_THRESHOLD,
        actual: errorRate,
        status: errorRate <= SLO_TARGETS.ERROR_RATE_THRESHOLD ? 'healthy' : 'violation'
      },
      concurrentUsers: {
        target: SLO_TARGETS.MAX_CONCURRENT_USERS,
        actual: maxConcurrentUsers,
        status: maxConcurrentUsers <= SLO_TARGETS.MAX_CONCURRENT_USERS ? 'healthy' : 'violation'
      },
      totalRequests: metrics.length,
      endpoints: endpointStats,
      recommendations
    }
  }

  /**
   * 負荷テストシナリオ実行
   */
  async runLoadTest(scenario: LoadTestScenario): Promise<LoadTestResult> {
    console.log(`🧪 負荷テスト開始: ${scenario.name}`)
    
    const startTime = Date.now()
    const results: LoadTestMetric[] = []
    const errors: string[] = []
    
    try {
      // 段階的負荷増加
      for (let phase = 0; phase < scenario.phases.length; phase++) {
        const phaseConfig = scenario.phases[phase]
        console.log(`📈 Phase ${phase + 1}: ${phaseConfig.concurrentUsers} users for ${phaseConfig.durationMs}ms`)
        
        const phaseResults = await this.executeLoadTestPhase(phaseConfig)
        results.push(...phaseResults)
        
        // フェーズ間の休憩
        if (phase < scenario.phases.length - 1 && scenario.phases[phase + 1].rampUpMs) {
          await this.sleep(scenario.phases[phase + 1].rampUpMs!)
        }
      }
      
    } catch (error) {
      errors.push(`Load test execution failed: ${error}`)
    }
    
    const duration = Date.now() - startTime
    
    // 結果分析
    const analysis = this.analyzeLoadTestResults(results)
    
    console.log(`✅ 負荷テスト完了: ${duration}ms`)
    
    return {
      scenario: scenario.name,
      duration,
      totalRequests: results.length,
      successfulRequests: results.filter(r => r.success).length,
      failedRequests: results.filter(r => !r.success).length,
      averageResponseTime: analysis.averageResponseTime,
      p95ResponseTime: analysis.p95ResponseTime,
      p99ResponseTime: analysis.p99ResponseTime,
      maxResponseTime: analysis.maxResponseTime,
      minResponseTime: analysis.minResponseTime,
      throughput: results.length / (duration / 1000),
      errorRate: analysis.errorRate,
      sloCompliance: {
        availability: analysis.availability >= SLO_TARGETS.AVAILABILITY,
        responseTime: analysis.p95ResponseTime <= SLO_TARGETS.P95_RESPONSE_TIME,
        errorRate: analysis.errorRate <= SLO_TARGETS.ERROR_RATE_THRESHOLD
      },
      errors,
      recommendation: this.generateLoadTestRecommendations(analysis)
    }
  }

  /**
   * 負荷テストフェーズ実行
   */
  private async executeLoadTestPhase(phase: LoadTestPhase): Promise<LoadTestMetric[]> {
    const results: LoadTestMetric[] = []
    const startTime = Date.now()
    const endTime = startTime + phase.durationMs
    
    // 同時実行プロミス管理
    const activeRequests = new Set<Promise<LoadTestMetric>>()
    
    while (Date.now() < endTime) {
      // 同時実行数制御
      if (activeRequests.size < phase.concurrentUsers) {
        const requestPromise = this.simulateUserRequest(phase.endpoints)
        activeRequests.add(requestPromise)
        
        requestPromise
          .then(result => {
            results.push(result)
            activeRequests.delete(requestPromise)
          })
          .catch(error => {
            results.push({
              timestamp: Date.now(),
              responseTime: 0,
              success: false,
              endpoint: 'unknown',
              error: error.message
            })
            activeRequests.delete(requestPromise)
          })
      }
      
      // 要求間隔調整
      await this.sleep(phase.requestIntervalMs || 100)
    }
    
    // 残りのリクエスト完了待機
    await Promise.allSettled(Array.from(activeRequests))
    
    return results
  }

  /**
   * ユーザーリクエストシミュレーション
   */
  private async simulateUserRequest(endpoints: string[]): Promise<LoadTestMetric> {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
    const startTime = performance.now()
    
    try {
      // Next.js APIエンドポイントの場合、内部的にテスト
      const response = await this.makeTestRequest(endpoint)
      const responseTime = performance.now() - startTime
      
      return {
        timestamp: Date.now(),
        responseTime,
        success: response.ok,
        endpoint,
        statusCode: response.status
      }
      
    } catch (error) {
      const responseTime = performance.now() - startTime
      return {
        timestamp: Date.now(),
        responseTime,
        success: false,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * テストリクエスト実行（内部API用）
   */
  private async makeTestRequest(endpoint: string): Promise<Response> {
    // 本来はここで実際のHTTPリクエストを送信
    // この例では簡略化してシミュレーション
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const url = `${baseUrl}${endpoint}`
    
    return fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SLO-LoadTest/1.0'
      }
    })
  }

  /**
   * 負荷テスト結果分析
   */
  private analyzeLoadTestResults(results: LoadTestMetric[]): LoadTestAnalysis {
    if (results.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        errorRate: 0,
        availability: 1
      }
    }

    const successfulResults = results.filter(r => r.success)
    const responseTimes = successfulResults.map(r => r.responseTime).sort((a, b) => a - b)
    
    const p95Index = Math.ceil(responseTimes.length * 0.95) - 1
    const p99Index = Math.ceil(responseTimes.length * 0.99) - 1
    
    return {
      averageResponseTime: responseTimes.reduce((acc, time) => acc + time, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      maxResponseTime: Math.max(...responseTimes, 0),
      minResponseTime: Math.min(...responseTimes, Infinity),
      errorRate: (results.length - successfulResults.length) / results.length,
      availability: successfulResults.length / results.length
    }
  }

  /**
   * 負荷テスト推奨事項生成
   */
  private generateLoadTestRecommendations(analysis: LoadTestAnalysis): string[] {
    const recommendations: string[] = []
    
    if (analysis.p95ResponseTime > SLO_TARGETS.P95_RESPONSE_TIME) {
      recommendations.push(`P95応答時間が目標値${SLO_TARGETS.P95_RESPONSE_TIME}msを超過(${analysis.p95ResponseTime.toFixed(0)}ms): データベースクエリ最適化、キャッシュ戦略見直しを推奨`)
    }
    
    if (analysis.availability < SLO_TARGETS.AVAILABILITY) {
      recommendations.push(`可用性が目標値${(SLO_TARGETS.AVAILABILITY * 100).toFixed(1)}%を下回る(${(analysis.availability * 100).toFixed(1)}%): エラーハンドリング強化、冗長化設計を推奨`)
    }
    
    if (analysis.errorRate > SLO_TARGETS.ERROR_RATE_THRESHOLD) {
      recommendations.push(`エラー率が目標値${(SLO_TARGETS.ERROR_RATE_THRESHOLD * 100).toFixed(1)}%を超過(${(analysis.errorRate * 100).toFixed(1)}%): バリデーション強化、リトライロジック追加を推奨`)
    }
    
    if (analysis.p95ResponseTime <= SLO_TARGETS.P95_RESPONSE_TIME && analysis.availability >= SLO_TARGETS.AVAILABILITY) {
      recommendations.push('✅ 全SLO目標達成: 現在のパフォーマンス水準を維持')
    }
    
    return recommendations
  }

  /**
   * アラート送信
   */
  private sendAlert(alert: SLOAlert) {
    console.warn('🚨 SLO Alert:', alert)
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert)
      } catch (error) {
        console.error('Alert callback failed:', error)
      }
    })
  }

  /**
   * アラートハンドラー登録
   */
  onAlert(callback: (alert: SLOAlert) => void) {
    this.alertCallbacks.push(callback)
  }

  /**
   * 監視開始
   */
  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      // 定期的なヘルスチェック
      this.performPeriodicHealthCheck()
    }, 60 * 1000) // 1分間隔
  }

  /**
   * 定期ヘルスチェック
   */
  private performPeriodicHealthCheck() {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000)
    if (recentMetrics.length === 0) return
    
    const report = this.generateSLOReport(5 * 60 * 1000)
    
    console.log(`📊 SLO Health Check:`, {
      availability: `${(report.availability.actual * 100).toFixed(2)}%`,
      p95ResponseTime: `${report.responseTime.actual.toFixed(0)}ms`,
      errorRate: `${(report.errorRate.actual * 100).toFixed(2)}%`,
      requests: report.totalRequests
    })
  }

  /**
   * 監視停止
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
  }

  /**
   * ユーティリティ: スリープ
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 型定義
interface SLOViolation {
  type: 'availability' | 'response_time' | 'error_rate' | 'concurrent_users'
  target: number
  actual: number
  severity: 'warning' | 'critical'
}

interface SLOAlert {
  timestamp: number
  violations: SLOViolation[]
  context: {
    totalMetrics: number
    timeWindow: string
    currentMetric: SLOMetrics
  }
}

interface SLOReport {
  period: string
  timestamp: number
  availability: { target: number; actual: number; status: 'healthy' | 'violation' }
  responseTime: { target: number; actual: number; status: 'healthy' | 'violation' }
  errorRate: { target: number; actual: number; status: 'healthy' | 'violation' }
  concurrentUsers: { target: number; actual: number; status: 'healthy' | 'violation' }
  totalRequests: number
  endpoints: Record<string, EndpointStats>
  recommendations: string[]
}

interface EndpointStats {
  requests: number
  errors: number
  totalResponseTime: number
  maxResponseTime: number
  minResponseTime: number
}

interface LoadTestScenario {
  name: string
  phases: LoadTestPhase[]
}

interface LoadTestPhase {
  concurrentUsers: number
  durationMs: number
  endpoints: string[]
  requestIntervalMs?: number
  rampUpMs?: number
}

interface LoadTestMetric {
  timestamp: number
  responseTime: number
  success: boolean
  endpoint: string
  statusCode?: number
  error?: string
}

interface LoadTestResult {
  scenario: string
  duration: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  throughput: number
  errorRate: number
  sloCompliance: {
    availability: boolean
    responseTime: boolean
    errorRate: boolean
  }
  errors: string[]
  recommendation: string[]
}

interface LoadTestAnalysis {
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  errorRate: number
  availability: number
}

// エクスポート
export const sloMonitor = new SLOMonitor()

// 定義済み負荷テストシナリオ
export const LOAD_TEST_SCENARIOS: Record<string, LoadTestScenario> = {
  BASIC_100CCU: {
    name: 'Basic 100 Concurrent Users',
    phases: [
      {
        concurrentUsers: 25,
        durationMs: 30 * 1000,
        endpoints: ['/api/analytics', '/api/sales'],
        requestIntervalMs: 200,
        rampUpMs: 5000
      },
      {
        concurrentUsers: 50,
        durationMs: 60 * 1000,
        endpoints: ['/api/analytics', '/api/sales', '/api/export'],
        requestIntervalMs: 150,
        rampUpMs: 10000
      },
      {
        concurrentUsers: 100,
        durationMs: 120 * 1000,
        endpoints: ['/api/analytics', '/api/sales', '/api/export', '/api/audit'],
        requestIntervalMs: 100
      }
    ]
  },
  STRESS_150CCU: {
    name: 'Stress Test 150 Concurrent Users',
    phases: [
      {
        concurrentUsers: 100,
        durationMs: 60 * 1000,
        endpoints: ['/api/analytics'],
        requestIntervalMs: 100,
        rampUpMs: 10000
      },
      {
        concurrentUsers: 150,
        durationMs: 180 * 1000,
        endpoints: ['/api/analytics', '/api/sales', '/api/export', '/api/audit'],
        requestIntervalMs: 50
      }
    ]
  }
}
