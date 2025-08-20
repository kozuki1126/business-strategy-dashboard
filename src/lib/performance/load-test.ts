/**
 * Load Testing & SLO Verification System
 * Task #014: 性能・p95最適化実装 - 負荷テスト・SLO検証
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

interface LoadTestConfig {
  concurrentUsers: number
  durationMinutes: number
  rampUpSeconds: number
  endpoints: string[]
  thresholds: {
    availability: number // 99.5%
    p95ResponseTime: number // 1500ms
    errorRate: number // 0.5%
  }
}

interface LoadTestMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  availability: number
  responseTimeP95: number
  responseTimeP99: number
  averageResponseTime: number
  errorRate: number
  requestsPerSecond: number
  concurrentUsers: number
  testDuration: number
}

interface LoadTestResult {
  config: LoadTestConfig
  metrics: LoadTestMetrics
  sloMet: boolean
  violations: string[]
  recommendations: string[]
  timestamp: Date
  passed: boolean
}

export class LoadTestRunner {
  private results: number[] = []
  private errors: Error[] = []
  private startTime: number = 0
  private config: LoadTestConfig

  constructor(config: LoadTestConfig) {
    this.config = config
  }

  /**
   * Execute 100CCU Load Test for 30 minutes
   */
  async runSLOVerificationTest(): Promise<LoadTestResult> {
    console.log('🚀 Starting SLO Verification Load Test')
    console.log(`Target: ${this.config.concurrentUsers}CCU for ${this.config.durationMinutes}min`)
    
    this.startTime = Date.now()
    const endTime = this.startTime + (this.config.durationMinutes * 60 * 1000)
    
    // Initialize metrics tracking
    this.results = []
    this.errors = []

    // Ramp up users gradually
    const userBatches = this.calculateRampUp()
    
    console.log(`📈 Ramping up ${userBatches.length} batches over ${this.config.rampUpSeconds}s`)

    const runningPromises: Promise<void>[] = []

    // Start user batches with ramp-up
    for (let i = 0; i < userBatches.length; i++) {
      const batchSize = userBatches[i]
      const delay = (this.config.rampUpSeconds / userBatches.length) * i * 1000

      setTimeout(() => {
        for (let user = 0; user < batchSize; user++) {
          const userPromise = this.simulateUser(endTime, i * batchSize + user)
          runningPromises.push(userPromise)
        }
      }, delay)
    }

    // Wait for all users to complete
    console.log('⏳ Load test in progress...')
    await new Promise(resolve => setTimeout(resolve, this.config.durationMinutes * 60 * 1000 + 10000))

    // Calculate final metrics
    const metrics = this.calculateMetrics()
    const sloMet = this.verifySLO(metrics)
    const violations = this.detectViolations(metrics)
    const recommendations = this.generateRecommendations(metrics)

    const result: LoadTestResult = {
      config: this.config,
      metrics,
      sloMet,
      violations,
      recommendations,
      timestamp: new Date(),
      passed: sloMet && violations.length === 0
    }

    this.logResults(result)
    return result
  }

  /**
   * Simulate a single user session
   */
  private async simulateUser(endTime: number, userId: number): Promise<void> {
    const userStartTime = Date.now()
    
    while (Date.now() < endTime) {
      try {
        // Random endpoint selection
        const endpoint = this.config.endpoints[Math.floor(Math.random() * this.config.endpoints.length)]
        
        // Realistic user behavior patterns
        const requestStartTime = performance.now()
        
        await this.makeRequest(endpoint, userId)
        
        const responseTime = performance.now() - requestStartTime
        this.results.push(responseTime)

        // Random think time between requests (1-5 seconds)
        const thinkTime = 1000 + Math.random() * 4000
        await new Promise(resolve => setTimeout(resolve, thinkTime))

      } catch (error) {
        this.errors.push(error as Error)
        
        // Retry delay for failed requests
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  /**
   * Make HTTP request to endpoint
   */
  private async makeRequest(endpoint: string, userId: number): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = `${baseUrl}${endpoint}`

    // Add realistic query parameters
    const params = new URLSearchParams({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
      userId: userId.toString(),
      loadTest: 'true'
    })

    const fullUrl = `${url}?${params.toString()}`

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `LoadTest-User-${userId}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      // 5 second timeout
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Consume response body to simulate real usage
    await response.json()
  }

  /**
   * Calculate ramp-up user batches
   */
  private calculateRampUp(): number[] {
    const totalUsers = this.config.concurrentUsers
    const rampUpBatches = Math.min(10, totalUsers) // Max 10 batches
    const usersPerBatch = Math.ceil(totalUsers / rampUpBatches)
    
    const batches: number[] = []
    let remainingUsers = totalUsers
    
    for (let i = 0; i < rampUpBatches && remainingUsers > 0; i++) {
      const batchSize = Math.min(usersPerBatch, remainingUsers)
      batches.push(batchSize)
      remainingUsers -= batchSize
    }
    
    return batches
  }

  /**
   * Calculate load test metrics
   */
  private calculateMetrics(): LoadTestMetrics {
    const totalRequests = this.results.length + this.errors.length
    const successfulRequests = this.results.length
    const failedRequests = this.errors.length
    
    const availability = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    
    // Calculate percentiles
    const sortedResults = [...this.results].sort((a, b) => a - b)
    const p95Index = Math.ceil(sortedResults.length * 0.95) - 1
    const p99Index = Math.ceil(sortedResults.length * 0.99) - 1
    
    const responseTimeP95 = sortedResults[p95Index] || 0
    const responseTimeP99 = sortedResults[p99Index] || 0
    const averageResponseTime = sortedResults.length > 0 
      ? sortedResults.reduce((sum, time) => sum + time, 0) / sortedResults.length 
      : 0

    const testDuration = Date.now() - this.startTime
    const requestsPerSecond = totalRequests / (testDuration / 1000)

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      availability,
      responseTimeP95,
      responseTimeP99,
      averageResponseTime,
      errorRate,
      requestsPerSecond,
      concurrentUsers: this.config.concurrentUsers,
      testDuration: testDuration / 1000 // Convert to seconds
    }
  }

  /**
   * Verify SLO compliance
   */
  private verifySLO(metrics: LoadTestMetrics): boolean {
    const { thresholds } = this.config
    
    return metrics.availability >= thresholds.availability &&
           metrics.responseTimeP95 <= thresholds.p95ResponseTime &&
           metrics.errorRate <= thresholds.errorRate
  }

  /**
   * Detect SLO violations
   */
  private detectViolations(metrics: LoadTestMetrics): string[] {
    const violations: string[] = []
    const { thresholds } = this.config

    if (metrics.availability < thresholds.availability) {
      violations.push(
        `Availability violation: ${metrics.availability.toFixed(2)}% < ${thresholds.availability}%`
      )
    }

    if (metrics.responseTimeP95 > thresholds.p95ResponseTime) {
      violations.push(
        `P95 response time violation: ${metrics.responseTimeP95.toFixed(0)}ms > ${thresholds.p95ResponseTime}ms`
      )
    }

    if (metrics.errorRate > thresholds.errorRate) {
      violations.push(
        `Error rate violation: ${metrics.errorRate.toFixed(2)}% > ${thresholds.errorRate}%`
      )
    }

    return violations
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: LoadTestMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.responseTimeP95 > 1000) {
      recommendations.push('Consider implementing additional caching layers')
      recommendations.push('Review database query optimization')
      recommendations.push('Evaluate CDN configuration')
    }

    if (metrics.availability < 99.0) {
      recommendations.push('Investigate infrastructure scaling')
      recommendations.push('Review error handling and circuit breakers')
      recommendations.push('Consider implementing graceful degradation')
    }

    if (metrics.errorRate > 1.0) {
      recommendations.push('Review application error handling')
      recommendations.push('Implement better retry mechanisms')
      recommendations.push('Monitor third-party service dependencies')
    }

    if (metrics.requestsPerSecond < 10) {
      recommendations.push('Consider horizontal scaling')
      recommendations.push('Review application performance bottlenecks')
    }

    return recommendations
  }

  /**
   * Log detailed test results
   */
  private logResults(result: LoadTestResult): void {
    console.log('\n📊 LOAD TEST RESULTS')
    console.log('=' .repeat(50))
    console.log(`Test Duration: ${result.metrics.testDuration.toFixed(0)}s`)
    console.log(`Concurrent Users: ${result.metrics.concurrentUsers}`)
    console.log(`Total Requests: ${result.metrics.totalRequests}`)
    console.log(`Successful Requests: ${result.metrics.successfulRequests}`)
    console.log(`Failed Requests: ${result.metrics.failedRequests}`)
    console.log(`Availability: ${result.metrics.availability.toFixed(2)}% (Target: ≥${result.config.thresholds.availability}%)`)
    console.log(`P95 Response Time: ${result.metrics.responseTimeP95.toFixed(0)}ms (Target: ≤${result.config.thresholds.p95ResponseTime}ms)`)
    console.log(`P99 Response Time: ${result.metrics.responseTimeP99.toFixed(0)}ms`)
    console.log(`Average Response Time: ${result.metrics.averageResponseTime.toFixed(0)}ms`)
    console.log(`Error Rate: ${result.metrics.errorRate.toFixed(2)}% (Target: ≤${result.config.thresholds.errorRate}%)`)
    console.log(`Requests/Second: ${result.metrics.requestsPerSecond.toFixed(1)}`)
    
    console.log('\n🎯 SLO VERIFICATION')
    console.log('=' .repeat(30))
    console.log(`Overall SLO Met: ${result.sloMet ? '✅ PASS' : '❌ FAIL'}`)
    
    if (result.violations.length > 0) {
      console.log('\n⚠️  VIOLATIONS:')
      result.violations.forEach(violation => console.log(`  - ${violation}`))
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      result.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
    
    console.log(`\n🏁 Test Result: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
  }
}

/**
 * Pre-configured SLO Verification Test
 */
export async function runSLOVerificationTest(): Promise<LoadTestResult> {
  const config: LoadTestConfig = {
    concurrentUsers: 100,
    durationMinutes: 30,
    rampUpSeconds: 60,
    endpoints: [
      '/api/analytics',
      '/api/analytics/correlation',
      '/api/export',
      '/api/sales'
    ],
    thresholds: {
      availability: 99.5,
      p95ResponseTime: 1500,
      errorRate: 0.5
    }
  }

  const loadTest = new LoadTestRunner(config)
  return await loadTest.runSLOVerificationTest()
}

/**
 * Quick Performance Smoke Test
 */
export async function runSmokeTest(): Promise<LoadTestResult> {
  const config: LoadTestConfig = {
    concurrentUsers: 10,
    durationMinutes: 2,
    rampUpSeconds: 10,
    endpoints: ['/api/analytics'],
    thresholds: {
      availability: 99.0,
      p95ResponseTime: 2000,
      errorRate: 1.0
    }
  }

  const loadTest = new LoadTestRunner(config)
  return await loadTest.runSLOVerificationTest()
}

/**
 * Generate Load Test Report
 */
export function generateLoadTestReport(results: LoadTestResult[]): string {
  const latest = results[results.length - 1]
  const trend = results.length > 1 ? results.slice(-5) : [latest]

  return `
# Load Test Report

## Latest Test Results (${latest.timestamp.toISOString()})

### Test Configuration
- **Concurrent Users**: ${latest.config.concurrentUsers}
- **Duration**: ${latest.config.durationMinutes} minutes
- **Endpoints**: ${latest.config.endpoints.join(', ')}

### Performance Metrics
- **Availability**: ${latest.metrics.availability.toFixed(2)}% (Target: ≥${latest.config.thresholds.availability}%)
- **P95 Response Time**: ${latest.metrics.responseTimeP95.toFixed(0)}ms (Target: ≤${latest.config.thresholds.p95ResponseTime}ms)
- **Error Rate**: ${latest.metrics.errorRate.toFixed(2)}% (Target: ≤${latest.config.thresholds.errorRate}%)
- **Requests/Second**: ${latest.metrics.requestsPerSecond.toFixed(1)}

### SLO Compliance
${latest.sloMet ? '✅ **PASSED**' : '❌ **FAILED**'}

${latest.violations.length > 0 ? `
### Violations
${latest.violations.map(v => `- ${v}`).join('\n')}
` : ''}

${latest.recommendations.length > 0 ? `
### Recommendations
${latest.recommendations.map(r => `- ${r}`).join('\n')}
` : ''}

### Trend Analysis (Last 5 Tests)
${trend.map(t => `
- ${t.timestamp.toISOString().split('T')[0]}: Availability ${t.metrics.availability.toFixed(1)}%, P95 ${t.metrics.responseTimeP95.toFixed(0)}ms
`).join('')}
`
}
