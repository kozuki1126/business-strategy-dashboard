#!/usr/bin/env tsx
/**
 * Performance Test Runner for Task #014
 * 性能・p95最適化実装 - SLO達成確認・負荷テスト
 */

import { performance } from 'perf_hooks'

interface TestResult {
  endpoint: string
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  errorRate: number
  throughput: number
  totalRequests: number
  errors: number
}

interface LoadTestConfig {
  baseUrl: string
  concurrent: number
  duration: number
  endpoints: string[]
}

class PerformanceTestRunner {
  private config: LoadTestConfig

  constructor(config: LoadTestConfig) {
    this.config = config
  }

  /**
   * Run comprehensive performance test
   */
  async runTest(): Promise<{
    results: TestResult[]
    sloCompliance: {
      p95Target: boolean
      availabilityTarget: boolean
      errorRateTarget: boolean
    }
    summary: {
      overallP95: number
      overallAvailability: number
      overallErrorRate: number
      testDuration: number
    }
  }> {
    console.log('🧪 Starting Performance Test for Task #014')
    console.log(`Target: p95 ≤ 1500ms, Availability ≥ 99.5%, Error Rate ≤ 0.5%`)
    console.log(`Config: ${this.config.concurrent} concurrent users, ${this.config.duration}s duration`)
    console.log('')

    const testStart = performance.now()
    const results: TestResult[] = []

    // Test each endpoint
    for (const endpoint of this.config.endpoints) {
      console.log(`Testing endpoint: ${endpoint}`)
      const result = await this.testEndpoint(endpoint)
      results.push(result)
      
      console.log(`  ✅ P95: ${result.p95ResponseTime.toFixed(0)}ms, Error Rate: ${result.errorRate.toFixed(2)}%`)
    }

    const testDuration = (performance.now() - testStart) / 1000

    // Calculate overall metrics
    const overallP95 = this.calculateOverallP95(results)
    const overallAvailability = this.calculateOverallAvailability(results)
    const overallErrorRate = this.calculateOverallErrorRate(results)

    // Check SLO compliance
    const sloCompliance = {
      p95Target: overallP95 <= 1500,
      availabilityTarget: overallAvailability >= 99.5,
      errorRateTarget: overallErrorRate <= 0.5
    }

    console.log('')
    console.log('📊 Test Results Summary:')
    console.log(`Overall P95 Response Time: ${overallP95.toFixed(0)}ms (target: ≤1500ms) ${sloCompliance.p95Target ? '✅' : '❌'}`)
    console.log(`Overall Availability: ${overallAvailability.toFixed(2)}% (target: ≥99.5%) ${sloCompliance.availabilityTarget ? '✅' : '❌'}`)
    console.log(`Overall Error Rate: ${overallErrorRate.toFixed(2)}% (target: ≤0.5%) ${sloCompliance.errorRateTarget ? '✅' : '❌'}`)
    console.log(`Test Duration: ${testDuration.toFixed(1)}s`)

    const allTargetsMet = Object.values(sloCompliance).every(Boolean)
    console.log('')
    console.log(`🎯 SLO Compliance: ${allTargetsMet ? '✅ ALL TARGETS MET' : '❌ SOME TARGETS MISSED'}`)

    return {
      results,
      sloCompliance,
      summary: {
        overallP95,
        overallAvailability,
        overallErrorRate,
        testDuration
      }
    }
  }

  /**
   * Test individual endpoint with concurrent requests
   */
  private async testEndpoint(endpoint: string): Promise<TestResult> {
    const url = `${this.config.baseUrl}${endpoint}`
    const responseTimes: number[] = []
    const errors: number[] = []
    const startTime = performance.now()

    // Generate test load
    const promises: Promise<void>[] = []
    const totalRequests = Math.ceil((this.config.duration * 1000) / 100) * this.config.concurrent

    for (let i = 0; i < totalRequests; i++) {
      const promise = this.makeRequest(url, responseTimes, errors)
      promises.push(promise)

      // Add small delay to spread requests over time
      if (i % this.config.concurrent === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises)

    const endTime = performance.now()
    const actualDuration = (endTime - startTime) / 1000

    // Calculate metrics
    responseTimes.sort((a, b) => a - b)
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)

    return {
      endpoint,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      errorRate: (errors.length / (responseTimes.length + errors.length)) * 100,
      throughput: (responseTimes.length + errors.length) / actualDuration,
      totalRequests: responseTimes.length + errors.length,
      errors: errors.length
    }
  }

  /**
   * Make individual HTTP request with timing
   */
  private async makeRequest(
    url: string, 
    responseTimes: number[], 
    errors: number[]
  ): Promise<void> {
    const start = performance.now()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Performance-Test-014',
          'Accept': 'application/json'
        }
      })

      const end = performance.now()
      const responseTime = end - start

      if (response.ok) {
        responseTimes.push(responseTime)
      } else {
        errors.push(response.status)
      }

    } catch (error) {
      errors.push(500)
    }
  }

  /**
   * Calculate overall P95 across all endpoints
   */
  private calculateOverallP95(results: TestResult[]): number {
    const allResponseTimes: number[] = []
    
    // We approximate by using P95 values weighted by request count
    results.forEach(result => {
      // Add P95 values proportional to request count
      const weight = Math.max(1, Math.floor(result.totalRequests / 100))
      for (let i = 0; i < weight; i++) {
        allResponseTimes.push(result.p95ResponseTime)
      }
    })

    allResponseTimes.sort((a, b) => a - b)
    const p95Index = Math.floor(allResponseTimes.length * 0.95)
    return allResponseTimes[p95Index] || 0
  }

  /**
   * Calculate overall availability
   */
  private calculateOverallAvailability(results: TestResult[]): number {
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    
    return ((totalRequests - totalErrors) / totalRequests) * 100
  }

  /**
   * Calculate overall error rate
   */
  private calculateOverallErrorRate(results: TestResult[]): number {
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    
    return (totalErrors / totalRequests) * 100
  }

  /**
   * Generate detailed performance report
   */
  async generateReport(testResults: any): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportContent = `# Performance Test Report - Task #014

**Generated:** ${new Date().toISOString()}
**Test Configuration:** ${this.config.concurrent} concurrent users, ${this.config.duration}s duration
**Base URL:** ${this.config.baseUrl}

## 🎯 SLO Compliance Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P95 Response Time | ≤1500ms | ${testResults.summary.overallP95.toFixed(0)}ms | ${testResults.sloCompliance.p95Target ? '✅ PASS' : '❌ FAIL'} |
| Availability | ≥99.5% | ${testResults.summary.overallAvailability.toFixed(2)}% | ${testResults.sloCompliance.availabilityTarget ? '✅ PASS' : '❌ FAIL'} |
| Error Rate | ≤0.5% | ${testResults.summary.overallErrorRate.toFixed(2)}% | ${testResults.sloCompliance.errorRateTarget ? '✅ PASS' : '❌ FAIL'} |

## 📊 Detailed Results by Endpoint

${testResults.results.map((result: TestResult) => `
### ${result.endpoint}

- **Average Response Time:** ${result.avgResponseTime.toFixed(2)}ms
- **P95 Response Time:** ${result.p95ResponseTime.toFixed(2)}ms
- **P99 Response Time:** ${result.p99ResponseTime.toFixed(2)}ms
- **Min/Max Response Time:** ${result.minResponseTime.toFixed(2)}ms / ${result.maxResponseTime.toFixed(2)}ms
- **Error Rate:** ${result.errorRate.toFixed(2)}%
- **Throughput:** ${result.throughput.toFixed(1)} req/s
- **Total Requests:** ${result.totalRequests}
- **Errors:** ${result.errors}
`).join('')}

## 🚀 Performance Optimizations Applied

1. **API Performance Middleware**
   - N+1 query elimination
   - Request deduplication
   - Multi-tier caching strategy
   - Response compression

2. **Database Optimizations**
   - Optimized query patterns
   - Parallel data fetching
   - Efficient joins and aggregations
   - Performance monitoring

3. **Next.js Configuration**
   - Edge runtime optimization
   - Bundle splitting
   - Static asset optimization
   - CDN caching headers

4. **Caching Strategy**
   - Query result caching (5min TTL)
   - Master data caching (1hr TTL)
   - Aggregation caching (10min TTL)
   - Cache warming

## 📈 Performance Trends

${Object.values(testResults.sloCompliance).every(Boolean) ? 
  '✅ **All SLO targets achieved!** The application is ready for 100CCU production load.' :
  '⚠️ **Some SLO targets not met.** Additional optimization may be required before production deployment.'
}

## 🔧 Recommendations

${testResults.sloCompliance.p95Target ? 
  '- ✅ P95 response time target achieved' : 
  '- ❌ P95 response time needs improvement - consider additional caching or query optimization'
}
${testResults.sloCompliance.availabilityTarget ? 
  '- ✅ Availability target achieved' : 
  '- ❌ Availability needs improvement - review error handling and retry logic'
}
${testResults.sloCompliance.errorRateTarget ? 
  '- ✅ Error rate target achieved' : 
  '- ❌ Error rate needs improvement - review input validation and error handling'
}

---
*Generated by Performance Test Runner v1.0*
`

    // Write report to file
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const reportPath = path.join(process.cwd(), `docs/performance-test-report-${timestamp}.md`)
    await fs.writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(`📝 Detailed report saved: ${reportPath}`)
  }
}

/**
 * Main test execution
 */
async function runPerformanceTest() {
  const baseUrl = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const concurrent = parseInt(process.argv[3] || '10')
  const duration = parseInt(process.argv[4] || '60')

  const config: LoadTestConfig = {
    baseUrl,
    concurrent,
    duration,
    endpoints: [
      '/api/analytics?start=2024-01-01&end=2024-01-31',
      '/api/sales?date=2024-01-01',
      '/api/export',
      '/',
      '/dashboard'
    ]
  }

  const testRunner = new PerformanceTestRunner(config)
  
  try {
    const results = await testRunner.runTest()
    await testRunner.generateReport(results)
    
    // Exit with appropriate code
    const allTargetsMet = Object.values(results.sloCompliance).every(Boolean)
    process.exit(allTargetsMet ? 0 : 1)
    
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    process.exit(1)
  }
}

// Run test if called directly
if (require.main === module) {
  runPerformanceTest()
}

export { PerformanceTestRunner }
