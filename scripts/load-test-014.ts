/**
 * Comprehensive Load Testing Script for Task #014
 * 100CCU Load Test with 99.5% Availability Verification
 */

import { performance } from 'perf_hooks'
import fetch from 'node-fetch'
import { sloMonitor } from '@/lib/monitoring/slo-monitor'

interface LoadTestConfig {
  baseUrl: string
  concurrentUsers: number
  testDuration: number // seconds
  rampUpTime: number // seconds
  scenarios: LoadTestScenario[]
  thresholds: {
    availability: number
    p95ResponseTime: number
    errorRate: number
    throughput: number
  }
}

interface LoadTestScenario {
  name: string
  weight: number // Percentage of traffic
  requests: Array<{
    method: 'GET' | 'POST'
    path: string
    body?: any
    headers?: Record<string, string>
    expectedStatus?: number
  }>
  thinkTime: { min: number; max: number } // milliseconds
}

interface LoadTestResult {
  config: LoadTestConfig
  summary: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    duration: number
    throughput: number
    availability: number
    errorRate: number
  }
  performanceMetrics: {
    responseTime: {
      min: number
      max: number
      avg: number
      p50: number
      p95: number
      p99: number
    }
    concurrency: {
      target: number
      actual: number
      maxAchieved: number
    }
  }
  sloCompliance: {
    availability: { target: number; actual: number; passed: boolean }
    p95ResponseTime: { target: number; actual: number; passed: boolean }
    errorRate: { target: number; actual: number; passed: boolean }
    overallPassed: boolean
  }
  errors: Array<{
    timestamp: number
    error: string
    request: string
    responseTime: number
  }>
  recommendations: string[]
}

/**
 * Advanced Load Testing Engine
 */
export class LoadTestEngine {
  private config: LoadTestConfig
  private isRunning = false
  private results: LoadTestResult
  private workers: Array<Promise<void>> = []
  private metrics: {
    requests: number
    responses: number
    errors: number
    responseTimes: number[]
    startTime: number
    activeUsers: number
  }

  constructor(config: LoadTestConfig) {
    this.config = config
    this.initializeResults()
    this.initializeMetrics()
  }

  /**
   * Initialize results structure
   */
  private initializeResults(): void {
    this.results = {
      config: this.config,
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        duration: 0,
        throughput: 0,
        availability: 0,
        errorRate: 0
      },
      performanceMetrics: {
        responseTime: {
          min: Infinity,
          max: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0
        },
        concurrency: {
          target: this.config.concurrentUsers,
          actual: 0,
          maxAchieved: 0
        }
      },
      sloCompliance: {
        availability: { target: this.config.thresholds.availability, actual: 0, passed: false },
        p95ResponseTime: { target: this.config.thresholds.p95ResponseTime, actual: 0, passed: false },
        errorRate: { target: this.config.thresholds.errorRate, actual: 0, passed: false },
        overallPassed: false
      },
      errors: [],
      recommendations: []
    }
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      responseTimes: [],
      startTime: 0,
      activeUsers: 0
    }
  }

  /**
   * Run comprehensive load test
   */
  async runLoadTest(): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${this.config.concurrentUsers} CCU for ${this.config.testDuration}s`)
    console.log(`Target: ${this.config.thresholds.availability}% availability, p95≤${this.config.thresholds.p95ResponseTime}ms`)

    this.isRunning = true
    this.metrics.startTime = Date.now()

    try {
      // Phase 1: Ramp up users gradually
      await this.rampUpPhase()

      // Phase 2: Sustained load
      await this.sustainedLoadPhase()

      // Phase 3: Ramp down
      await this.rampDownPhase()

      // Calculate final results
      this.calculateFinalResults()

    } catch (error) {
      console.error('Load test error:', error)
      this.isRunning = false
    }

    this.isRunning = false
    return this.results
  }

  /**
   * Ramp up phase - gradually increase load
   */
  private async rampUpPhase(): Promise<void> {
    console.log(`⬆️  Ramping up to ${this.config.concurrentUsers} users over ${this.config.rampUpTime}s`)

    const userIncrement = Math.ceil(this.config.concurrentUsers / (this.config.rampUpTime / 5)) // Every 5 seconds
    let currentUsers = 0

    while (currentUsers < this.config.concurrentUsers && this.isRunning) {
      const usersToAdd = Math.min(userIncrement, this.config.concurrentUsers - currentUsers)
      
      for (let i = 0; i < usersToAdd; i++) {
        this.startVirtualUser()
        currentUsers++
        this.metrics.activeUsers = currentUsers
        this.results.performanceMetrics.concurrency.actual = currentUsers
        this.results.performanceMetrics.concurrency.maxAchieved = Math.max(
          this.results.performanceMetrics.concurrency.maxAchieved,
          currentUsers
        )
      }

      console.log(`👥 Active users: ${currentUsers}/${this.config.concurrentUsers}`)
      await this.sleep(5000) // 5 second intervals
    }
  }

  /**
   * Sustained load phase - maintain peak load
   */
  private async sustainedLoadPhase(): Promise<void> {
    console.log(`⚡ Sustained load phase: ${this.config.testDuration}s with ${this.config.concurrentUsers} CCU`)

    const sustainedDuration = this.config.testDuration * 1000
    const monitoringInterval = 30000 // 30 seconds

    let elapsed = 0
    while (elapsed < sustainedDuration && this.isRunning) {
      const intervalStart = Date.now()

      // Monitor performance during sustained load
      await this.performPerformanceCheck()

      // Ensure we maintain target concurrency
      if (this.metrics.activeUsers < this.config.concurrentUsers) {
        const shortage = this.config.concurrentUsers - this.metrics.activeUsers
        console.log(`🔄 Restarting ${shortage} users to maintain concurrency`)
        
        for (let i = 0; i < shortage; i++) {
          this.startVirtualUser()
        }
      }

      // Wait for monitoring interval
      const intervalElapsed = Date.now() - intervalStart
      const remainingTime = Math.max(0, monitoringInterval - intervalElapsed)
      await this.sleep(remainingTime)

      elapsed += monitoringInterval
      
      // Progress update
      const progress = (elapsed / sustainedDuration) * 100
      console.log(`📊 Progress: ${progress.toFixed(1)}% | Requests: ${this.metrics.requests} | Errors: ${this.metrics.errors}`)
    }
  }

  /**
   * Ramp down phase - gracefully reduce load
   */
  private async rampDownPhase(): Promise<void> {
    console.log('⬇️  Ramp down phase: stopping virtual users')
    this.isRunning = false

    // Wait for active requests to complete
    const maxWaitTime = 30000 // 30 seconds
    const startWait = Date.now()

    while (this.workers.length > 0 && (Date.now() - startWait) < maxWaitTime) {
      console.log(`⏳ Waiting for ${this.workers.length} active requests to complete...`)
      await this.sleep(1000)
      
      // Remove completed workers
      this.workers = this.workers.filter(worker => {
        return worker.catch(() => false) // Convert to boolean promise
      })
    }

    console.log('✅ All virtual users stopped')
  }

  /**
   * Start a virtual user session
   */
  private startVirtualUser(): void {
    const worker = this.virtualUserSession()
    this.workers.push(worker)

    worker.finally(() => {
      this.metrics.activeUsers = Math.max(0, this.metrics.activeUsers - 1)
      this.results.performanceMetrics.concurrency.actual = this.metrics.activeUsers
    })
  }

  /**
   * Virtual user session - simulates user behavior
   */
  private async virtualUserSession(): Promise<void> {
    while (this.isRunning) {
      try {
        // Select random scenario based on weight
        const scenario = this.selectScenario()
        
        // Execute scenario requests
        for (const request of scenario.requests) {
          if (!this.isRunning) break

          await this.executeRequest(request, scenario.name)

          // Think time between requests
          const thinkTime = this.randomBetween(scenario.thinkTime.min, scenario.thinkTime.max)
          await this.sleep(thinkTime)
        }

        // Session think time
        await this.sleep(this.randomBetween(1000, 5000))

      } catch (error) {
        console.warn('Virtual user error:', error)
        break
      }
    }
  }

  /**
   * Select scenario based on weight
   */
  private selectScenario(): LoadTestScenario {
    const random = Math.random() * 100
    let cumulative = 0

    for (const scenario of this.config.scenarios) {
      cumulative += scenario.weight
      if (random <= cumulative) {
        return scenario
      }
    }

    return this.config.scenarios[0] // Fallback
  }

  /**
   * Execute individual request
   */
  private async executeRequest(
    request: { method: 'GET' | 'POST'; path: string; body?: any; headers?: Record<string, string>; expectedStatus?: number },
    scenarioName: string
  ): Promise<void> {
    const startTime = performance.now()
    this.metrics.requests++

    try {
      const url = `${this.config.baseUrl}${request.path}`
      const options: any = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTest/1.0',
          ...request.headers
        },
        timeout: 30000
      }

      if (request.body) {
        options.body = JSON.stringify(request.body)
      }

      const response = await fetch(url, options)
      const responseTime = performance.now() - startTime

      this.recordResponse(response, responseTime, scenarioName)

      // Check expected status
      if (request.expectedStatus && response.status !== request.expectedStatus) {
        this.recordError(
          `Unexpected status: ${response.status} (expected: ${request.expectedStatus})`,
          `${request.method} ${request.path}`,
          responseTime
        )
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      this.recordError(
        error instanceof Error ? error.message : 'Unknown error',
        `${request.method} ${request.path}`,
        responseTime
      )
    }
  }

  /**
   * Record successful response
   */
  private recordResponse(response: any, responseTime: number, scenarioName: string): void {
    this.metrics.responses++
    this.metrics.responseTimes.push(responseTime)

    // Update response time metrics
    this.results.performanceMetrics.responseTime.min = Math.min(
      this.results.performanceMetrics.responseTime.min,
      responseTime
    )
    this.results.performanceMetrics.responseTime.max = Math.max(
      this.results.performanceMetrics.responseTime.max,
      responseTime
    )

    // Record in SLO monitor
    sloMonitor.recordMetric('p95_response_time', responseTime, {
      scenario: scenarioName,
      status: response.status
    })

    if (response.ok) {
      sloMonitor.recordMetric('availability', 100)
      this.results.summary.successfulRequests++
    } else {
      sloMonitor.recordMetric('availability', 0)
      this.recordError(`HTTP ${response.status}`, response.url, responseTime)
    }
  }

  /**
   * Record error
   */
  private recordError(error: string, request: string, responseTime: number): void {
    this.metrics.errors++
    this.results.summary.failedRequests++

    this.results.errors.push({
      timestamp: Date.now(),
      error,
      request,
      responseTime
    })

    sloMonitor.recordMetric('error_rate', 1, { error, request })
    sloMonitor.recordMetric('availability', 0)
  }

  /**
   * Perform performance check during sustained load
   */
  private async performPerformanceCheck(): Promise<void> {
    if (this.metrics.responseTimes.length === 0) return

    const sortedTimes = [...this.metrics.responseTimes].sort((a, b) => a - b)
    const p95Index = Math.ceil(sortedTimes.length * 0.95) - 1
    const currentP95 = sortedTimes[Math.max(0, p95Index)]

    const currentAvailability = this.metrics.responses > 0 
      ? (this.results.summary.successfulRequests / this.metrics.responses) * 100
      : 0

    const currentErrorRate = this.metrics.responses > 0
      ? (this.metrics.errors / this.metrics.responses) * 100
      : 0

    // Check SLO compliance in real-time
    if (currentP95 > this.config.thresholds.p95ResponseTime) {
      console.warn(`⚠️  P95 response time: ${currentP95.toFixed(0)}ms (target: ≤${this.config.thresholds.p95ResponseTime}ms)`)
    }

    if (currentAvailability < this.config.thresholds.availability) {
      console.warn(`⚠️  Availability: ${currentAvailability.toFixed(2)}% (target: ≥${this.config.thresholds.availability}%)`)
    }

    if (currentErrorRate > this.config.thresholds.errorRate) {
      console.warn(`⚠️  Error rate: ${currentErrorRate.toFixed(2)}% (target: ≤${this.config.thresholds.errorRate}%)`)
    }

    // Log progress
    console.log(`📈 Current metrics: P95=${currentP95.toFixed(0)}ms, Availability=${currentAvailability.toFixed(2)}%, Errors=${currentErrorRate.toFixed(2)}%`)
  }

  /**
   * Calculate final test results
   */
  private calculateFinalResults(): void {
    const duration = Date.now() - this.metrics.startTime
    this.results.summary.duration = duration
    this.results.summary.totalRequests = this.metrics.requests
    this.results.summary.throughput = (this.metrics.requests / duration) * 1000 // requests per second

    if (this.metrics.responseTimes.length > 0) {
      const sortedTimes = this.metrics.responseTimes.sort((a, b) => a - b)
      
      this.results.performanceMetrics.responseTime.avg = 
        this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / this.metrics.responseTimes.length
      
      this.results.performanceMetrics.responseTime.p50 = 
        sortedTimes[Math.floor(sortedTimes.length * 0.5)]
      
      this.results.performanceMetrics.responseTime.p95 = 
        sortedTimes[Math.floor(sortedTimes.length * 0.95)]
      
      this.results.performanceMetrics.responseTime.p99 = 
        sortedTimes[Math.floor(sortedTimes.length * 0.99)]

      // Fix infinity issue
      if (this.results.performanceMetrics.responseTime.min === Infinity) {
        this.results.performanceMetrics.responseTime.min = 0
      }
    }

    // Calculate final SLO compliance
    this.results.summary.availability = this.metrics.responses > 0 
      ? (this.results.summary.successfulRequests / this.metrics.responses) * 100
      : 0

    this.results.summary.errorRate = this.metrics.responses > 0
      ? (this.metrics.errors / this.metrics.responses) * 100
      : 0

    this.results.sloCompliance.availability.actual = this.results.summary.availability
    this.results.sloCompliance.availability.passed = 
      this.results.summary.availability >= this.config.thresholds.availability

    this.results.sloCompliance.p95ResponseTime.actual = this.results.performanceMetrics.responseTime.p95
    this.results.sloCompliance.p95ResponseTime.passed = 
      this.results.performanceMetrics.responseTime.p95 <= this.config.thresholds.p95ResponseTime

    this.results.sloCompliance.errorRate.actual = this.results.summary.errorRate
    this.results.sloCompliance.errorRate.passed = 
      this.results.summary.errorRate <= this.config.thresholds.errorRate

    this.results.sloCompliance.overallPassed = 
      this.results.sloCompliance.availability.passed &&
      this.results.sloCompliance.p95ResponseTime.passed &&
      this.results.sloCompliance.errorRate.passed

    // Generate recommendations
    this.results.recommendations = this.generateRecommendations()
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (!this.results.sloCompliance.availability.passed) {
      recommendations.push('Improve system availability: implement circuit breakers and retry mechanisms')
      recommendations.push('Scale infrastructure: consider adding more server instances')
    }

    if (!this.results.sloCompliance.p95ResponseTime.passed) {
      recommendations.push('Optimize response times: review database queries and add indexes')
      recommendations.push('Implement more aggressive caching strategies')
      recommendations.push('Consider CDN implementation for static assets')
    }

    if (!this.results.sloCompliance.errorRate.passed) {
      recommendations.push('Improve error handling: implement better input validation')
      recommendations.push('Monitor third-party dependencies more closely')
    }

    if (this.results.performanceMetrics.concurrency.actual < this.config.concurrentUsers * 0.9) {
      recommendations.push('Investigate concurrency issues: users may be dropping due to errors')
    }

    return recommendations
  }

  /**
   * Utility functions
   */
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Run Task #014 compliance test
 */
export async function runTask014ComplianceTest(
  baseUrl: string = 'http://localhost:3000'
): Promise<LoadTestResult> {
  
  const config: LoadTestConfig = {
    baseUrl,
    concurrentUsers: 100,
    testDuration: 1800, // 30 minutes
    rampUpTime: 300, // 5 minutes
    scenarios: [
      {
        name: 'dashboard_browsing',
        weight: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/dashboard' },
          { method: 'GET', path: '/api/analytics/optimized?type=dashboard&startDate=2025-08-01&endDate=2025-08-22' }
        ],
        thinkTime: { min: 2000, max: 8000 }
      },
      {
        name: 'analytics_exploration',
        weight: 30,
        requests: [
          { method: 'GET', path: '/analytics' },
          { method: 'GET', path: '/api/analytics/optimized?type=correlation&startDate=2025-08-01&endDate=2025-08-22' },
          { method: 'GET', path: '/api/analytics?filters={"dateRange":{"start":"2025-08-01","end":"2025-08-22"}}' }
        ],
        thinkTime: { min: 3000, max: 10000 }
      },
      {
        name: 'sales_input',
        weight: 20,
        requests: [
          { method: 'GET', path: '/sales' },
          { method: 'POST', path: '/api/sales', body: {
            date: '2025-08-22',
            storeId: 1,
            department: 'electronics',
            productCategory: 'smartphone',
            revenueExTax: 50000,
            footfall: 120,
            transactions: 45
          }},
          { method: 'GET', path: '/dashboard' }
        ],
        thinkTime: { min: 5000, max: 15000 }
      },
      {
        name: 'export_operations',
        weight: 10,
        requests: [
          { method: 'GET', path: '/export' },
          { method: 'GET', path: '/api/analytics/optimized?type=export&startDate=2025-08-01&endDate=2025-08-22&limit=1000' }
        ],
        thinkTime: { min: 10000, max: 30000 }
      }
    ],
    thresholds: {
      availability: 99.5,
      p95ResponseTime: 1500,
      errorRate: 0.5,
      throughput: 10 // requests per second
    }
  }

  console.log('🎯 Running Task #014 Compliance Test')
  console.log('Target: 100CCU for 30 minutes with 99.5% availability')

  const engine = new LoadTestEngine(config)
  const result = await engine.runLoadTest()

  // Generate detailed report
  console.log('\n' + '='.repeat(80))
  console.log('🎉 TASK #014 COMPLIANCE TEST RESULTS')
  console.log('='.repeat(80))
  console.log(`📊 Total Requests: ${result.summary.totalRequests.toLocaleString()}`)
  console.log(`✅ Successful: ${result.summary.successfulRequests.toLocaleString()}`)
  console.log(`❌ Failed: ${result.summary.failedRequests.toLocaleString()}`)
  console.log(`⏱️  Duration: ${(result.summary.duration / 1000 / 60).toFixed(1)} minutes`)
  console.log(`🚀 Throughput: ${result.summary.throughput.toFixed(2)} req/s`)
  console.log(`📈 Availability: ${result.summary.availability.toFixed(2)}%`)
  console.log(`❌ Error Rate: ${result.summary.errorRate.toFixed(2)}%`)
  console.log(`⚡ P95 Response Time: ${result.performanceMetrics.responseTime.p95.toFixed(0)}ms`)
  console.log(`🎯 Overall SLO Compliance: ${result.sloCompliance.overallPassed ? '✅ PASSED' : '❌ FAILED'}`)

  if (!result.sloCompliance.overallPassed) {
    console.log('\n❌ SLO Violations:')
    if (!result.sloCompliance.availability.passed) {
      console.log(`   - Availability: ${result.sloCompliance.availability.actual.toFixed(2)}% < ${result.sloCompliance.availability.target}%`)
    }
    if (!result.sloCompliance.p95ResponseTime.passed) {
      console.log(`   - P95 Response Time: ${result.sloCompliance.p95ResponseTime.actual.toFixed(0)}ms > ${result.sloCompliance.p95ResponseTime.target}ms`)
    }
    if (!result.sloCompliance.errorRate.passed) {
      console.log(`   - Error Rate: ${result.sloCompliance.errorRate.actual.toFixed(2)}% > ${result.sloCompliance.errorRate.target}%`)
    }
  }

  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    result.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`)
    })
  }

  console.log('='.repeat(80))

  return result
}

// Export for use in tests and scripts
export { LoadTestEngine, LoadTestConfig, LoadTestResult, LoadTestScenario }
