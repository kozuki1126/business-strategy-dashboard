/**
 * SLO Monitoring and Alerting System for Task #014
 * 99.5% Availability & Performance Target Monitoring
 */

import { LRUCache } from 'lru-cache'

interface SLOTarget {
  name: string
  target: number
  unit: string
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
  category: 'availability' | 'performance' | 'error_rate' | 'throughput'
}

interface SLOMetric {
  timestamp: number
  value: number
  metadata?: Record<string, any>
}

interface SLOViolation {
  id: string
  target: SLOTarget
  actual: number
  severity: 'critical' | 'warning' | 'info'
  timestamp: number
  duration: number
  metadata?: Record<string, any>
}

interface SLOReport {
  period: string
  overallCompliance: number
  targets: Array<{
    name: string
    compliance: number
    violationCount: number
    worstValue: number
    averageValue: number
  }>
  violations: SLOViolation[]
  recommendations: string[]
}

/**
 * High-Performance SLO Monitor for Real-Time Performance Tracking
 */
export class SLOMonitor {
  private targets: Map<string, SLOTarget> = new Map()
  private metrics: Map<string, LRUCache<string, SLOMetric[]>> = new Map()
  private violations: LRUCache<string, SLOViolation> = new LRUCache({ max: 1000 })
  private alertCallbacks: Array<(violation: SLOViolation) => void> = []
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeDefaultTargets()
    this.initializeMetricsCaches()
  }

  /**
   * Initialize SLO targets for Task #014
   */
  private initializeDefaultTargets(): void {
    // Core SLO targets from PRD and acceptance criteria
    const targets: SLOTarget[] = [
      {
        name: 'availability',
        target: 99.5,
        unit: '%',
        operator: 'gte',
        category: 'availability'
      },
      {
        name: 'p95_response_time',
        target: 1500,
        unit: 'ms',
        operator: 'lte',
        category: 'performance'
      },
      {
        name: 'p95_api_response_time',
        target: 1000,
        unit: 'ms',
        operator: 'lte',
        category: 'performance'
      },
      {
        name: 'dashboard_initial_load',
        target: 3000,
        unit: 'ms',
        operator: 'lte',
        category: 'performance'
      },
      {
        name: 'export_p95_time',
        target: 5000,
        unit: 'ms',
        operator: 'lte',
        category: 'performance'
      },
      {
        name: 'error_rate',
        target: 0.5,
        unit: '%',
        operator: 'lte',
        category: 'error_rate'
      },
      {
        name: 'cache_hit_ratio',
        target: 85,
        unit: '%',
        operator: 'gte',
        category: 'performance'
      },
      {
        name: 'concurrent_users',
        target: 100,
        unit: 'users',
        operator: 'gte',
        category: 'throughput'
      },
      {
        name: 'etl_completion_time',
        target: 600,
        unit: 'seconds',
        operator: 'lte',
        category: 'performance'
      },
      {
        name: 'database_connection_pool',
        target: 90,
        unit: '%',
        operator: 'lte',
        category: 'performance'
      }
    ]

    targets.forEach(target => {
      this.targets.set(target.name, target)
    })
  }

  /**
   * Initialize metrics caches for each target
   */
  private initializeMetricsCaches(): void {
    this.targets.forEach((target, name) => {
      this.metrics.set(name, new LRUCache({
        max: 1000, // Keep last 1000 measurements
        ttl: 24 * 60 * 60 * 1000 // 24 hours
      }))
    })
  }

  /**
   * Record a metric value
   */
  recordMetric(targetName: string, value: number, metadata?: Record<string, any>): void {
    const target = this.targets.get(targetName)
    if (!target) {
      console.warn(`Unknown SLO target: ${targetName}`)
      return
    }

    const metricsCache = this.metrics.get(targetName)
    if (!metricsCache) return

    const timestamp = Date.now()
    const timeKey = Math.floor(timestamp / 60000).toString() // 1-minute buckets

    const metric: SLOMetric = {
      timestamp,
      value,
      metadata
    }

    // Get existing metrics for this time bucket
    const existingMetrics = metricsCache.get(timeKey) || []
    existingMetrics.push(metric)
    metricsCache.set(timeKey, existingMetrics)

    // Check for SLO violation
    this.checkViolation(target, value, metadata)
  }

  /**
   * Check if a metric violates SLO target
   */
  private checkViolation(target: SLOTarget, value: number, metadata?: Record<string, any>): void {
    let isViolation = false

    switch (target.operator) {
      case 'lt':
        isViolation = value >= target.target
        break
      case 'lte':
        isViolation = value > target.target
        break
      case 'gt':
        isViolation = value <= target.target
        break
      case 'gte':
        isViolation = value < target.target
        break
      case 'eq':
        isViolation = value !== target.target
        break
    }

    if (isViolation) {
      this.recordViolation(target, value, metadata)
    }
  }

  /**
   * Record SLO violation
   */
  private recordViolation(target: SLOTarget, actualValue: number, metadata?: Record<string, any>): void {
    const severity = this.calculateSeverity(target, actualValue)
    const violationId = `${target.name}_${Date.now()}`

    const violation: SLOViolation = {
      id: violationId,
      target,
      actual: actualValue,
      severity,
      timestamp: Date.now(),
      duration: 0, // Will be calculated for ongoing violations
      metadata
    }

    this.violations.set(violationId, violation)

    // Trigger alerts
    this.alertCallbacks.forEach(callback => {
      try {
        callback(violation)
      } catch (error) {
        console.error('Alert callback error:', error)
      }
    })

    console.warn(`SLO Violation: ${target.name} = ${actualValue}${target.unit} (target: ${target.operator} ${target.target}${target.unit})`)
  }

  /**
   * Calculate violation severity
   */
  private calculateSeverity(target: SLOTarget, actualValue: number): 'critical' | 'warning' | 'info' {
    const deviation = Math.abs(actualValue - target.target) / target.target

    if (target.category === 'availability') {
      if (deviation > 0.02) return 'critical' // >2% deviation in availability
      if (deviation > 0.01) return 'warning'  // >1% deviation
      return 'info'
    }

    if (target.category === 'performance') {
      if (deviation > 0.5) return 'critical'  // >50% deviation
      if (deviation > 0.2) return 'warning'   // >20% deviation
      return 'info'
    }

    if (target.category === 'error_rate') {
      if (deviation > 2) return 'critical'    // Error rate >2x target
      if (deviation > 1) return 'warning'     // Error rate >1x target
      return 'info'
    }

    return 'warning'
  }

  /**
   * Add alert callback
   */
  onViolation(callback: (violation: SLOViolation) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMinutes: number = 5): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck()
    }, intervalMinutes * 60 * 1000)

    console.log(`SLO monitoring started with ${intervalMinutes} minute intervals`)
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('SLO monitoring stopped')
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check system availability
      await this.checkSystemAvailability()
      
      // Check performance metrics
      await this.checkPerformanceMetrics()
      
      // Check error rates
      await this.checkErrorRates()
      
      // Check cache performance
      await this.checkCachePerformance()
      
    } catch (error) {
      console.error('Health check error:', error)
      this.recordMetric('availability', 0, { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  /**
   * Check system availability
   */
  private async checkSystemAvailability(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Test basic endpoint availability
      const response = await fetch('/api/health', {
        method: 'GET',
        timeout: 5000
      })
      
      const responseTime = Date.now() - startTime
      const isAvailable = response.ok
      
      this.recordMetric('availability', isAvailable ? 100 : 0, {
        responseTime,
        status: response.status
      })
      
      if (isAvailable) {
        this.recordMetric('p95_response_time', responseTime)
      }
      
    } catch (error) {
      this.recordMetric('availability', 0, { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  /**
   * Check performance metrics
   */
  private async checkPerformanceMetrics(): Promise<void> {
    // This would integrate with actual performance monitoring
    // For now, we'll simulate based on recent metrics
    
    const recentMetrics = this.getRecentMetrics('p95_response_time', 5) // Last 5 minutes
    if (recentMetrics.length > 0) {
      const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
      
      if (avgResponseTime > 1500) {
        this.recordViolation(
          this.targets.get('p95_response_time')!,
          avgResponseTime,
          { source: 'health_check', sampleSize: recentMetrics.length }
        )
      }
    }
  }

  /**
   * Check error rates
   */
  private async checkErrorRates(): Promise<void> {
    // This would integrate with actual error tracking
    // Placeholder implementation
    const recentErrors = this.getRecentMetrics('error_rate', 10) // Last 10 minutes
    
    if (recentErrors.length > 0) {
      const avgErrorRate = recentErrors.reduce((sum, m) => sum + m.value, 0) / recentErrors.length
      
      if (avgErrorRate > 0.5) {
        this.recordViolation(
          this.targets.get('error_rate')!,
          avgErrorRate,
          { source: 'health_check', sampleSize: recentErrors.length }
        )
      }
    }
  }

  /**
   * Check cache performance
   */
  private async checkCachePerformance(): Promise<void> {
    // This would integrate with actual cache monitoring
    // Placeholder implementation based on cache stats
    const cacheMetrics = this.getRecentMetrics('cache_hit_ratio', 5)
    
    if (cacheMetrics.length > 0) {
      const avgHitRatio = cacheMetrics.reduce((sum, m) => sum + m.value, 0) / cacheMetrics.length
      
      if (avgHitRatio < 85) {
        this.recordViolation(
          this.targets.get('cache_hit_ratio')!,
          avgHitRatio,
          { source: 'health_check', sampleSize: cacheMetrics.length }
        )
      }
    }
  }

  /**
   * Get recent metrics for a target
   */
  private getRecentMetrics(targetName: string, minutes: number): SLOMetric[] {
    const metricsCache = this.metrics.get(targetName)
    if (!metricsCache) return []

    const cutoffTime = Date.now() - (minutes * 60 * 1000)
    const allMetrics: SLOMetric[] = []

    for (const [, metrics] of metricsCache.entries()) {
      allMetrics.push(...metrics.filter(m => m.timestamp >= cutoffTime))
    }

    return allMetrics.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Generate SLO compliance report
   */
  generateSLOReport(periodHours: number = 24): SLOReport {
    const cutoffTime = Date.now() - (periodHours * 60 * 60 * 1000)
    const periodViolations = Array.from(this.violations.values())
      .filter(v => v.timestamp >= cutoffTime)

    const targetReports = Array.from(this.targets.entries()).map(([name, target]) => {
      const recentMetrics = this.getRecentMetrics(name, periodHours * 60)
      const targetViolations = periodViolations.filter(v => v.target.name === name)
      
      const compliance = recentMetrics.length > 0 
        ? ((recentMetrics.length - targetViolations.length) / recentMetrics.length) * 100
        : 100

      return {
        name,
        compliance,
        violationCount: targetViolations.length,
        worstValue: recentMetrics.length > 0 
          ? Math.max(...recentMetrics.map(m => m.value)) 
          : 0,
        averageValue: recentMetrics.length > 0 
          ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length 
          : 0
      }
    })

    const overallCompliance = targetReports.reduce((sum, r) => sum + r.compliance, 0) / targetReports.length

    const recommendations = this.generateRecommendations(targetReports, periodViolations)

    return {
      period: `${periodHours} hours`,
      overallCompliance,
      targets: targetReports,
      violations: periodViolations,
      recommendations
    }
  }

  /**
   * Generate recommendations based on violations
   */
  private generateRecommendations(targetReports: any[], violations: SLOViolation[]): string[] {
    const recommendations: string[] = []

    // Performance recommendations
    const perfViolations = violations.filter(v => v.target.category === 'performance')
    if (perfViolations.length > 0) {
      recommendations.push('Optimize database queries with materialized views and indexes')
      recommendations.push('Implement aggressive caching for frequently accessed data')
      recommendations.push('Consider scaling infrastructure to handle increased load')
    }

    // Availability recommendations
    const availViolations = violations.filter(v => v.target.category === 'availability')
    if (availViolations.length > 0) {
      recommendations.push('Implement circuit breakers for external dependencies')
      recommendations.push('Add health checks and automatic failover mechanisms')
      recommendations.push('Review error handling and implement graceful degradation')
    }

    // Error rate recommendations
    const errorViolations = violations.filter(v => v.target.category === 'error_rate')
    if (errorViolations.length > 0) {
      recommendations.push('Improve input validation and error handling')
      recommendations.push('Monitor third-party service dependencies')
      recommendations.push('Implement retry mechanisms with exponential backoff')
    }

    return recommendations
  }

  /**
   * Get current SLO status
   */
  getCurrentStatus(): {
    overallHealth: 'healthy' | 'degraded' | 'critical'
    activeViolations: number
    criticalViolations: number
    recentMetrics: Record<string, number>
  } {
    const recentViolations = Array.from(this.violations.values())
      .filter(v => v.timestamp > Date.now() - 5 * 60 * 1000) // Last 5 minutes

    const criticalViolations = recentViolations.filter(v => v.severity === 'critical').length
    const activeViolations = recentViolations.length

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (criticalViolations > 0) {
      overallHealth = 'critical'
    } else if (activeViolations > 0) {
      overallHealth = 'degraded'
    }

    const recentMetrics: Record<string, number> = {}
    this.targets.forEach((target, name) => {
      const metrics = this.getRecentMetrics(name, 5)
      if (metrics.length > 0) {
        recentMetrics[name] = metrics[0].value
      }
    })

    return {
      overallHealth,
      activeViolations,
      criticalViolations,
      recentMetrics
    }
  }
}

/**
 * Global SLO monitor instance
 */
export const sloMonitor = new SLOMonitor()

/**
 * Initialize SLO monitoring with alerts
 */
export function initializeSLOMonitoring(): void {
  // Set up alert handlers
  sloMonitor.onViolation((violation) => {
    console.warn(`🚨 SLO Violation: ${violation.target.name}`, {
      actual: violation.actual,
      target: violation.target.target,
      severity: violation.severity,
      metadata: violation.metadata
    })

    // Here you would integrate with actual alerting systems:
    // - Send email notifications
    // - Post to Slack/Teams
    // - Create monitoring system alerts
    // - Log to external monitoring services
  })

  // Start monitoring every 5 minutes
  sloMonitor.startMonitoring(5)

  console.log('SLO monitoring initialized for Task #014')
}

/**
 * Express middleware for automatic SLO monitoring
 */
export function sloMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()

    res.on('finish', () => {
      const responseTime = Date.now() - startTime
      const isError = res.statusCode >= 400

      // Record metrics
      sloMonitor.recordMetric('p95_response_time', responseTime, {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode
      })

      if (isError) {
        sloMonitor.recordMetric('error_rate', 1, {
          path: req.path,
          statusCode: res.statusCode
        })
      } else {
        sloMonitor.recordMetric('error_rate', 0)
      }

      sloMonitor.recordMetric('availability', isError ? 0 : 100, {
        path: req.path,
        responseTime
      })
    })

    next()
  }
}

// Export types
export type { SLOTarget, SLOMetric, SLOViolation, SLOReport }
