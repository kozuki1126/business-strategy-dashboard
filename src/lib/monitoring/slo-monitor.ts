/**
 * SLO Monitoring System
 * Task #014: 性能・p95最適化実装 - SLO監視・アラート
 * 
 * Monitors: 99.5% availability, p95 ≤ 1500ms response time
 */

import { createClient } from '@/lib/supabase/server'
import { NotificationService } from '@/lib/notifications/service'

interface SLOMetrics {
  availability: number
  p95ResponseTime: number
  errorRate: number
  throughput: number
  timestamp: Date
}

interface SLOTarget {
  availability: number
  p95ResponseTime: number
  errorRate: number
  name: string
}

interface SLOViolation {
  target: string
  actual: number
  expected: number
  severity: 'warning' | 'critical'
  timestamp: Date
  duration: number
  description: string
}

class SLOMonitor {
  private supabase = createClient()
  private notificationService = new NotificationService()
  
  // SLO Targets
  private targets: SLOTarget[] = [
    {
      name: 'High Availability',
      availability: 99.5,
      p95ResponseTime: 1500,
      errorRate: 0.5
    },
    {
      name: 'Performance',
      availability: 99.0,
      p95ResponseTime: 2000,
      errorRate: 1.0
    }
  ]

  private violationHistory: SLOViolation[] = []

  /**
   * Check current SLO status
   */
  async checkSLO(timeWindowMinutes: number = 60): Promise<{
    metrics: SLOMetrics
    violations: SLOViolation[]
    status: 'healthy' | 'warning' | 'critical'
  }> {
    try {
      // Get current metrics from database
      const { data: sloData, error } = await this.supabase
        .rpc('check_slo_compliance', { time_window_minutes: timeWindowMinutes })

      if (error) {
        console.error('SLO check failed:', error)
        throw new Error(`SLO check failed: ${error.message}`)
      }

      const metrics: SLOMetrics = {
        availability: sloData.metrics.availability,
        p95ResponseTime: sloData.metrics.p95_response_time,
        errorRate: sloData.metrics.error_rate,
        throughput: 0, // Calculate from request count
        timestamp: new Date()
      }

      // Check violations
      const violations = this.detectViolations(metrics)
      
      // Determine overall status
      const status = this.calculateStatus(violations)

      // Handle violations
      if (violations.length > 0) {
        await this.handleViolations(violations, metrics)
      }

      return { metrics, violations, status }
    } catch (error) {
      console.error('SLO monitoring error:', error)
      throw error
    }
  }

  /**
   * Detect SLO violations
   */
  private detectViolations(metrics: SLOMetrics): SLOViolation[] {
    const violations: SLOViolation[] = []
    const primaryTarget = this.targets[0] // High Availability

    // Check availability
    if (metrics.availability < primaryTarget.availability) {
      const severity = metrics.availability < 99.0 ? 'critical' : 'warning'
      violations.push({
        target: 'availability',
        actual: metrics.availability,
        expected: primaryTarget.availability,
        severity,
        timestamp: metrics.timestamp,
        duration: 0, // Calculate in real implementation
        description: `Availability ${metrics.availability.toFixed(2)}% is below target ${primaryTarget.availability}%`
      })
    }

    // Check p95 response time
    if (metrics.p95ResponseTime > primaryTarget.p95ResponseTime) {
      const severity = metrics.p95ResponseTime > 3000 ? 'critical' : 'warning'
      violations.push({
        target: 'p95_response_time',
        actual: metrics.p95ResponseTime,
        expected: primaryTarget.p95ResponseTime,
        severity,
        timestamp: metrics.timestamp,
        duration: 0,
        description: `P95 response time ${metrics.p95ResponseTime.toFixed(0)}ms exceeds target ${primaryTarget.p95ResponseTime}ms`
      })
    }

    // Check error rate
    if (metrics.errorRate > primaryTarget.errorRate) {
      const severity = metrics.errorRate > 2.0 ? 'critical' : 'warning'
      violations.push({
        target: 'error_rate',
        actual: metrics.errorRate,
        expected: primaryTarget.errorRate,
        severity,
        timestamp: metrics.timestamp,
        duration: 0,
        description: `Error rate ${metrics.errorRate.toFixed(2)}% exceeds target ${primaryTarget.errorRate}%`
      })
    }

    return violations
  }

  /**
   * Calculate overall system status
   */
  private calculateStatus(violations: SLOViolation[]): 'healthy' | 'warning' | 'critical' {
    if (violations.length === 0) {
      return 'healthy'
    }

    const hasCritical = violations.some(v => v.severity === 'critical')
    return hasCritical ? 'critical' : 'warning'
  }

  /**
   * Handle SLO violations
   */
  private async handleViolations(violations: SLOViolation[], metrics: SLOMetrics): Promise<void> {
    // Add to violation history
    this.violationHistory.push(...violations)

    // Send notifications for new violations
    for (const violation of violations) {
      await this.sendViolationAlert(violation, metrics)
    }

    // Log violations for audit
    for (const violation of violations) {
      try {
        await this.supabase
          .from('audit_log')
          .insert({
            actor_id: 'system',
            action: 'slo_violation',
            target: 'slo_monitor',
            meta: {
              violation: violation,
              metrics: metrics,
              timestamp: new Date().toISOString()
            }
          })
      } catch (error) {
        console.error('Failed to log SLO violation:', error)
      }
    }
  }

  /**
   * Send violation alert notification
   */
  private async sendViolationAlert(violation: SLOViolation, metrics: SLOMetrics): Promise<void> {
    const subject = `🚨 SLO Violation: ${violation.target} (${violation.severity.toUpperCase()})`
    
    const emailBody = `
<h2>🚨 Service Level Objective Violation Detected</h2>

<h3>Violation Details</h3>
<ul>
  <li><strong>Target:</strong> ${violation.target}</li>
  <li><strong>Severity:</strong> ${violation.severity.toUpperCase()}</li>
  <li><strong>Actual Value:</strong> ${this.formatMetricValue(violation.target, violation.actual)}</li>
  <li><strong>Expected Value:</strong> ${this.formatMetricValue(violation.target, violation.expected)}</li>
  <li><strong>Description:</strong> ${violation.description}</li>
  <li><strong>Timestamp:</strong> ${violation.timestamp.toISOString()}</li>
</ul>

<h3>Current System Metrics</h3>
<ul>
  <li><strong>Availability:</strong> ${metrics.availability.toFixed(2)}% (Target: ≥99.5%)</li>
  <li><strong>P95 Response Time:</strong> ${metrics.p95ResponseTime.toFixed(0)}ms (Target: ≤1500ms)</li>
  <li><strong>Error Rate:</strong> ${metrics.errorRate.toFixed(2)}% (Target: ≤0.5%)</li>
  <li><strong>Measured At:</strong> ${metrics.timestamp.toISOString()}</li>
</ul>

<h3>Recommended Actions</h3>
${this.getRecommendedActions(violation)}

<h3>Dashboard Links</h3>
<ul>
  <li><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">Performance Dashboard</a></li>
  <li><a href="${process.env.NEXT_PUBLIC_APP_URL}/audit">Audit Logs</a></li>
</ul>

<p><em>This alert was generated automatically by the SLO monitoring system.</em></p>
`

    try {
      await this.notificationService.sendAlert({
        type: 'slo_violation',
        severity: violation.severity,
        subject,
        htmlContent: emailBody,
        recipients: process.env.EMAIL_RECIPIENTS_ALERTS?.split(',') || [],
        metadata: {
          violation,
          metrics,
          timestamp: new Date().toISOString()
        }
      })

      console.log(`✅ SLO violation alert sent for ${violation.target}`)
    } catch (error) {
      console.error('Failed to send SLO violation alert:', error)
    }
  }

  /**
   * Format metric values for display
   */
  private formatMetricValue(target: string, value: number): string {
    switch (target) {
      case 'availability':
        return `${value.toFixed(2)}%`
      case 'p95_response_time':
        return `${value.toFixed(0)}ms`
      case 'error_rate':
        return `${value.toFixed(2)}%`
      default:
        return value.toString()
    }
  }

  /**
   * Get recommended actions for violation type
   */
  private getRecommendedActions(violation: SLOViolation): string {
    const actions: { [key: string]: string[] } = {
      availability: [
        'Check server health and resource utilization',
        'Review recent deployments and rollback if necessary',
        'Verify database connectivity and performance',
        'Check for DDoS attacks or unusual traffic patterns',
        'Scale up infrastructure if needed'
      ],
      p95_response_time: [
        'Check for slow database queries',
        'Review cache hit rates and optimize caching',
        'Check for memory leaks or resource exhaustion',
        'Optimize API endpoints and database indexes',
        'Consider horizontal scaling of application servers'
      ],
      error_rate: [
        'Review application logs for error patterns',
        'Check for recent code changes that might cause errors',
        'Verify third-party service availability',
        'Check database connection pool status',
        'Review input validation and error handling'
      ]
    }

    const targetActions = actions[violation.target] || ['Review system logs and metrics']
    
    return `
<ol>
  ${targetActions.map(action => `<li>${action}</li>`).join('')}
</ol>
`
  }

  /**
   * Get SLO compliance report
   */
  async generateComplianceReport(days: number = 7): Promise<{
    summary: {
      overallCompliance: number
      availabilityCompliance: number
      performanceCompliance: number
      totalViolations: number
    }
    violations: SLOViolation[]
    trends: {
      availability: number[]
      p95ResponseTime: number[]
      errorRate: number[]
    }
  }> {
    // In real implementation, query historical data from database
    const report = {
      summary: {
        overallCompliance: 99.2,
        availabilityCompliance: 99.7,
        performanceCompliance: 98.5,
        totalViolations: this.violationHistory.length
      },
      violations: this.violationHistory.slice(-50), // Last 50 violations
      trends: {
        availability: [99.8, 99.6, 99.5, 99.9, 99.3, 99.7, 99.8],
        p95ResponseTime: [1200, 1450, 1600, 1300, 1800, 1400, 1350],
        errorRate: [0.2, 0.3, 0.8, 0.1, 1.2, 0.4, 0.3]
      }
    }

    return report
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMinutes: number = 5): void {
    console.log(`🔍 Starting SLO monitoring with ${intervalMinutes}min interval`)
    
    setInterval(async () => {
      try {
        const result = await this.checkSLO()
        console.log(`📊 SLO Check: ${result.status} (${result.violations.length} violations)`)
        
        if (result.violations.length > 0) {
          console.log('⚠️  Violations:', result.violations.map(v => v.target).join(', '))
        }
      } catch (error) {
        console.error('SLO monitoring check failed:', error)
      }
    }, intervalMinutes * 60 * 1000)
  }

  /**
   * Get current violation count for dashboard
   */
  getCurrentViolations(): SLOViolation[] {
    const now = new Date()
    const recentThreshold = new Date(now.getTime() - 60 * 60 * 1000) // Last hour
    
    return this.violationHistory.filter(v => v.timestamp > recentThreshold)
  }

  /**
   * Generate SLO status for health check endpoint
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    slo_met: boolean
    last_check: Date
    violations_count: number
  }> {
    try {
      const result = await this.checkSLO(15) // 15 minute window
      
      return {
        status: result.status === 'healthy' ? 'healthy' : 
                result.status === 'warning' ? 'degraded' : 'unhealthy',
        slo_met: result.violations.length === 0,
        last_check: result.metrics.timestamp,
        violations_count: result.violations.length
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        slo_met: false,
        last_check: new Date(),
        violations_count: -1
      }
    }
  }
}

// Singleton instance for application use
export const sloMonitor = new SLOMonitor()

// Export class for testing
export { SLOMonitor, SLOMetrics, SLOViolation }
