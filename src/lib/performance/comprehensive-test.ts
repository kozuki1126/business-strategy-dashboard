/**
 * Comprehensive Performance Test Suite for Task #014
 * 性能・p95最適化実装 - SLO達成検証・負荷テスト・パフォーマンス監視
 */

import { performance } from 'perf_hooks'
import fetch from 'node-fetch'

interface LoadTestConfig {
  baseUrl: string
  concurrent: number
  duration: number // seconds
  endpoints: string[]
  rampUpTime: number // seconds
}

interface TestMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  errorRate: number
  requestsPerSecond: number
  availability: number
}

interface SLOCompliance {
  availability: {
    target: number
    actual: number
    passed: boolean
  }
  p95ResponseTime: {
    target: number
    actual: number
    passed: boolean
  }
  errorRate: {
    target: number
    actual: number
    passed: boolean
  }
  overallCompliance: boolean
}

class PerformanceTestSuite {
  private config: LoadTestConfig
  private metrics: TestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errorRate: 0,
    requestsPerSecond: 0,
    availability: 0
  }
  private responseTimes: number[] = []
  private isRunning = false

  constructor(config: LoadTestConfig) {
    this.config = config
  }

  /**
   * Run comprehensive performance test
   */
  async runPerformanceTest(): Promise<{
    metrics: TestMetrics
    sloCompliance: SLOCompliance
    recommendations: string[]
  }> {
    console.log('🚀 Starting comprehensive performance test...')
    console.log(`Target: ${this.config.concurrent} concurrent users for ${this.config.duration}s`)
    console.log(`Endpoints: ${this.config.endpoints.join(', ')}`)
    
    // Reset metrics
    this.resetMetrics()
    
    // Start test
    this.isRunning = true
    const startTime = Date.now()
    
    // Ramp up users gradually
    await this.rampUpUsers()
    
    // Run sustained load
    await this.runSustainedLoad()
    
    // Calculate final metrics
    const endTime = Date.now()
    const totalDuration = (endTime - startTime) / 1000
    
    this.calculateFinalMetrics(totalDuration)
    
    // Check SLO compliance
    const sloCompliance = this.checkSLOCompliance()
    
    // Generate recommendations
    const recommendations = this.generateRecommendations()
    
    console.log('✅ Performance test completed')
    
    return {
      metrics: this.metrics,
      sloCompliance,
      recommendations
    }
  }

  /**
   * Gradually ramp up concurrent users
   */
  private async rampUpUsers(): Promise<void> {
    console.log(`⬆️  Ramping up to ${this.config.concurrent} concurrent users over ${this.config.rampUpTime}s`)
    
    const rampUpInterval = this.config.rampUpTime * 1000 / this.config.concurrent
    
    for (let i = 1; i <= this.config.concurrent; i++) {
      if (!this.isRunning) break
      
      // Start a user session
      this.startUserSession()
      
      // Wait before adding next user
      if (i < this.config.concurrent) {
        await this.sleep(rampUpInterval)
      }
    }
  }

  /**
   * Run sustained load for the specified duration
   */
  private async runSustainedLoad(): Promise<void> {
    console.log(`⚡ Running sustained load for ${this.config.duration}s`)
    
    // Wait for the test duration
    await this.sleep(this.config.duration * 1000)
    
    // Stop all active sessions
    this.isRunning = false
  }

  /**
   * Start a user session that makes requests continuously
   */
  private async startUserSession(): Promise<void> {
    while (this.isRunning) {
      // Pick a random endpoint
      const endpoint = this.config.endpoints[Math.floor(Math.random() * this.config.endpoints.length)]
      
      try {
        await this.makeRequest(endpoint)
        
        // Random think time between requests (0.5-2 seconds)
        const thinkTime = 500 + Math.random() * 1500
        await this.sleep(thinkTime)
        
      } catch (error) {
        console.warn('User session error:', error)
        break
      }
    }
  }

  /**
   * Make a single HTTP request and record metrics
   */
  private async makeRequest(endpoint: string): Promise<void> {
    const startTime = performance.now()
    
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'PerformanceTest/1.0',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      })
      
      const endTime = performance.now()
      const responseTime = endTime - startTime
      
      this.recordResponse(responseTime, response.ok)
      
    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime
      
      this.recordResponse(responseTime, false)
    }
  }

  /**
   * Record response metrics
   */
  private recordResponse(responseTime: number, success: boolean): void {
    this.responseTimes.push(responseTime)
    this.metrics.totalRequests++
    
    if (success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }
    
    // Update min/max response times
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime)
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime)
  }

  /**
   * Calculate final metrics from collected data
   */
  private calculateFinalMetrics(duration: number): void {
    if (this.responseTimes.length === 0) {
      console.warn('⚠️  No response times recorded')
      return
    }
    
    // Sort response times for percentile calculations
    this.responseTimes.sort((a, b) => a - b)
    
    // Calculate metrics
    this.metrics.avgResponseTime = this.responseTimes.reduce((sum, rt) => sum + rt, 0) / this.responseTimes.length
    this.metrics.p95ResponseTime = this.calculatePercentile(this.responseTimes, 0.95)
    this.metrics.p99ResponseTime = this.calculatePercentile(this.responseTimes, 0.99)
    this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100
    this.metrics.requestsPerSecond = this.metrics.totalRequests / duration
    this.metrics.availability = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
    
    // Fix infinity issue for min response time
    if (this.metrics.minResponseTime === Infinity) {
      this.metrics.minResponseTime = 0
    }
  }

  /**
   * Calculate percentile value from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * Check SLO compliance against targets
   */
  private checkSLOCompliance(): SLOCompliance {
    const targets = {
      availability: 99.5,
      p95ResponseTime: 1500,
      errorRate: 0.5
    }
    
    const compliance: SLOCompliance = {
      availability: {
        target: targets.availability,
        actual: this.metrics.availability,
        passed: this.metrics.availability >= targets.availability
      },
      p95ResponseTime: {
        target: targets.p95ResponseTime,
        actual: this.metrics.p95ResponseTime,
        passed: this.metrics.p95ResponseTime <= targets.p95ResponseTime
      },
      errorRate: {
        target: targets.errorRate,
        actual: this.metrics.errorRate,
        passed: this.metrics.errorRate <= targets.errorRate
      },
      overallCompliance: false
    }
    
    compliance.overallCompliance = compliance.availability.passed && 
                                  compliance.p95ResponseTime.passed && 
                                  compliance.errorRate.passed
    
    return compliance
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // Availability recommendations
    if (this.metrics.availability < 99.5) {
      recommendations.push('Improve system availability: Consider implementing circuit breakers and retry mechanisms')
      recommendations.push('Scale infrastructure: Add more server instances or upgrade capacity')
    }
    
    // Response time recommendations
    if (this.metrics.p95ResponseTime > 1500) {
      recommendations.push('Optimize response times: Review database queries and add more indexes')
      recommendations.push('Implement caching: Add Redis or memcached for frequently accessed data')
      recommendations.push('Enable CDN: Use CloudFront or similar for static assets')
    }
    
    // Error rate recommendations
    if (this.metrics.errorRate > 0.5) {
      recommendations.push('Reduce error rate: Implement better error handling and input validation')
      recommendations.push('Monitor dependencies: Check third-party service availability')
    }
    
    // General performance recommendations
    if (this.metrics.avgResponseTime > 800) {
      recommendations.push('General optimization: Consider implementing connection pooling')
      recommendations.push('Database optimization: Review slow queries and optimize indexes')
    }
    
    if (this.metrics.requestsPerSecond < 10) {
      recommendations.push('Throughput improvement: Optimize application server configuration')
      recommendations.push('Consider async processing: Move heavy operations to background jobs')
    }
    
    return recommendations
  }

  /**
   * Reset metrics for new test run
   */
  private resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errorRate: 0,
      requestsPerSecond: 0,
      availability: 0
    }
    this.responseTimes = []
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate detailed performance report
   */
  generateReport(metrics: TestMetrics, sloCompliance: SLOCompliance, recommendations: string[]): string {
    const report = `
# Performance Test Report - Task #014

**Test Date:** ${new Date().toISOString()}  
**Target:** 100CCU負荷・99.5%可用性・p95≤1500ms  
**Status:** ${sloCompliance.overallCompliance ? '✅ PASSED' : '❌ FAILED'}

## 🔧 Test Configuration

- **Concurrent Users:** ${this.config.concurrent}
- **Test Duration:** ${this.config.duration}s
- **Ramp-up Time:** ${this.config.rampUpTime}s
- **Endpoints Tested:** ${this.config.endpoints.length}
- **Base URL:** ${this.config.baseUrl}

## 📊 Performance Metrics

### Response Times
- **Average:** ${metrics.avgResponseTime.toFixed(2)}ms
- **P95:** ${metrics.p95ResponseTime.toFixed(2)}ms
- **P99:** ${metrics.p99ResponseTime.toFixed(2)}ms
- **Min:** ${metrics.minResponseTime.toFixed(2)}ms
- **Max:** ${metrics.maxResponseTime.toFixed(2)}ms

### Throughput & Reliability
- **Total Requests:** ${metrics.totalRequests.toLocaleString()}
- **Successful Requests:** ${metrics.successfulRequests.toLocaleString()}
- **Failed Requests:** ${metrics.failedRequests.toLocaleString()}
- **Requests/Second:** ${metrics.requestsPerSecond.toFixed(2)}
- **Availability:** ${metrics.availability.toFixed(2)}%
- **Error Rate:** ${metrics.errorRate.toFixed(2)}%

## 🎯 SLO Compliance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Availability | ≥${sloCompliance.availability.target}% | ${sloCompliance.availability.actual.toFixed(2)}% | ${sloCompliance.availability.passed ? '✅' : '❌'} |
| P95 Response Time | ≤${sloCompliance.p95ResponseTime.target}ms | ${sloCompliance.p95ResponseTime.actual.toFixed(0)}ms | ${sloCompliance.p95ResponseTime.passed ? '✅' : '❌'} |
| Error Rate | ≤${sloCompliance.errorRate.target}% | ${sloCompliance.errorRate.actual.toFixed(2)}% | ${sloCompliance.errorRate.passed ? '✅' : '❌'} |

**Overall SLO Compliance:** ${sloCompliance.overallCompliance ? '✅ PASSED' : '❌ FAILED'}

## 🚀 Performance Optimizations Applied

1. **Database Optimization**
   - Materialized views for dashboard aggregations
   - Composite indexes for frequently queried combinations
   - N+1 query elimination with aggregation functions

2. **Caching Strategy**
   - Multi-tier cache with LRU eviction
   - Stale-while-revalidate pattern
   - API response caching with 10-minute TTL

3. **Next.js Optimizations**
   - ISR (Incremental Static Regeneration)
   - Bundle splitting and code optimization
   - Image optimization with WebP/AVIF

4. **API Performance**
   - Response compression (gzip/brotli)
   - Connection pooling
   - Optimized analytics endpoints

## 📈 Recommendations

${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

## 🔍 Next Steps

${sloCompliance.overallCompliance ? 
  `✅ **All SLO targets achieved!**

- Continue monitoring performance in production
- Implement alerting for SLO violations
- Regular performance audits and optimizations
- Consider CDN implementation for global performance` :
  `❌ **Some SLO targets not met**

- Focus on areas with highest impact for improvement
- Implement additional optimizations based on recommendations
- Re-run tests after improvements
- Consider infrastructure scaling if needed`
}

## 📝 Test Environment

- **Node.js Version:** ${process.version}
- **Test Duration:** ${this.config.duration}s sustained load
- **Concurrent Users:** ${this.config.concurrent}
- **Total Test Time:** ${(this.config.rampUpTime + this.config.duration)} seconds

Generated by Performance Test Suite v1.0
`
    
    return report
  }
}

/**
 * Main function to run performance tests
 */
export async function runComprehensivePerformanceTest(
  baseUrl: string = 'http://localhost:3000',
  concurrent: number = 100,
  duration: number = 1800 // 30 minutes
): Promise<void> {
  const config: LoadTestConfig = {
    baseUrl,
    concurrent,
    duration,
    rampUpTime: 300, // 5 minutes ramp-up
    endpoints: [
      '/',
      '/dashboard',
      '/api/analytics',
      '/api/analytics/optimized?type=dashboard',
      '/api/analytics/optimized?type=correlation',
      '/api/sales',
      '/api/export',
      '/audit'
    ]
  }
  
  const testSuite = new PerformanceTestSuite(config)
  
  try {
    const result = await testSuite.runPerformanceTest()
    
    // Generate and save report
    const report = testSuite.generateReport(result.metrics, result.sloCompliance, result.recommendations)
    
    // Write report to file
    const fs = await import('fs/promises')
    const reportPath = `performance-test-report-${new Date().toISOString().split('T')[0]}.md`
    await fs.writeFile(reportPath, report)
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 PERFORMANCE TEST COMPLETED')
    console.log('='.repeat(60))
    console.log(`📊 Total Requests: ${result.metrics.totalRequests.toLocaleString()}`)
    console.log(`⚡ Avg Response Time: ${result.metrics.avgResponseTime.toFixed(2)}ms`)
    console.log(`📈 P95 Response Time: ${result.metrics.p95ResponseTime.toFixed(2)}ms`)
    console.log(`🎯 Availability: ${result.metrics.availability.toFixed(2)}%`)
    console.log(`❌ Error Rate: ${result.metrics.errorRate.toFixed(2)}%`)
    console.log(`🔄 Requests/Second: ${result.metrics.requestsPerSecond.toFixed(2)}`)
    console.log(`\n🎯 SLO Compliance: ${result.sloCompliance.overallCompliance ? '✅ PASSED' : '❌ FAILED'}`)
    
    if (!result.sloCompliance.overallCompliance) {
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
    
    console.log(`\n📝 Detailed report saved: ${reportPath}`)
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    process.exit(1)
  }
}

// Export for use in scripts
export { PerformanceTestSuite, LoadTestConfig, TestMetrics, SLOCompliance }
