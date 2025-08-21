#!/usr/bin/env tsx

/**
 * Load Test Script for Task #014 - Performance Optimization
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { createHash } from 'crypto'
import { performance } from 'perf_hooks'

interface LoadTestConfig {
  baseUrl: string
  concurrent: number
  duration: number
  rampUpTime: number
  scenarios: Array<{
    name: string
    weight: number
    endpoint: string
    method: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: any
  }>
}

interface TestResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  availability: number
  errors: Array<{
    error: string
    count: number
  }>
}

class LoadTest {
  private config: LoadTestConfig
  private results: Array<{
    timestamp: number
    responseTime: number
    success: boolean
    error?: string
    scenario: string
  }> = []
  private startTime: number = 0
  private activeRequests: number = 0

  constructor(config: LoadTestConfig) {
    this.config = config
  }

  private getTestScenarios(): LoadTestConfig['scenarios'] {
    return [
      {
        name: 'Dashboard Load',
        weight: 30,
        endpoint: '/dashboard',
        method: 'GET',
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      },
      {
        name: 'Analytics API',
        weight: 25,
        endpoint: '/api/analytics',
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      },
      {
        name: 'Sales Data',
        weight: 20,
        endpoint: '/api/sales',
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      },
      {
        name: 'Export API',
        weight: 10,
        endpoint: '/api/export',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sales',
          format: 'csv',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        })
      },
      {
        name: 'Correlation Analysis',
        weight: 10,
        endpoint: '/api/analytics/correlation',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          storeIds: ['store-001', 'store-002']
        })
      },
      {
        name: 'Audit Logs',
        weight: 5,
        endpoint: '/api/audit',
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    ]
  }

  private selectScenario(): LoadTestConfig['scenarios'][0] {
    const totalWeight = this.config.scenarios.reduce((sum, s) => sum + s.weight, 0)
    const random = Math.random() * totalWeight
    let currentWeight = 0
    
    for (const scenario of this.config.scenarios) {
      currentWeight += scenario.weight
      if (random <= currentWeight) {
        return scenario
      }
    }
    
    return this.config.scenarios[0]
  }

  private async makeRequest(scenario: LoadTestConfig['scenarios'][0]): Promise<void> {
    const startTime = performance.now()
    this.activeRequests++
    
    try {
      const url = `${this.config.baseUrl}${scenario.endpoint}`
      const options: RequestInit = {
        method: scenario.method,
        headers: {
          'User-Agent': 'LoadTest/1.0',
          'Accept-Encoding': 'gzip, deflate, br',
          ...scenario.headers
        },
        body: scenario.body
      }

      const response = await fetch(url, options)
      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.results.push({
        timestamp: Date.now(),
        responseTime,
        success: response.ok,
        scenario: scenario.name,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      })

    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.results.push({
        timestamp: Date.now(),
        responseTime,
        success: false,
        scenario: scenario.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      this.activeRequests--
    }
  }

  private async rampUp(): Promise<void> {
    const rampUpInterval = this.config.rampUpTime / this.config.concurrent
    
    for (let i = 0; i < this.config.concurrent; i++) {
      setTimeout(() => this.userLoop(), i * rampUpInterval)
    }
  }

  private async userLoop(): Promise<void> {
    const endTime = this.startTime + this.config.duration
    
    while (Date.now() < endTime) {
      const scenario = this.selectScenario()
      await this.makeRequest(scenario)
      
      // Random think time between 1-5 seconds
      const thinkTime = Math.random() * 4000 + 1000
      await new Promise(resolve => setTimeout(resolve, thinkTime))
    }
  }

  private calculateResults(): TestResult {
    const successfulResults = this.results.filter(r => r.success)
    const failedResults = this.results.filter(r => !r.success)
    
    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b)
    const testDurationMs = this.config.duration * 1000
    
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    
    // Count errors by type
    const errorCounts = new Map<string, number>()
    failedResults.forEach(r => {
      const error = r.error || 'Unknown error'
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1)
    })
    
    const errors = Array.from(errorCounts.entries()).map(([error, count]) => ({
      error,
      count
    }))

    return {
      totalRequests: this.results.length,
      successfulRequests: successfulResults.length,
      failedRequests: failedResults.length,
      averageResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      requestsPerSecond: this.results.length / (testDurationMs / 1000),
      availability: (successfulResults.length / this.results.length) * 100,
      errors
    }
  }

  private printResults(results: TestResult): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 LOAD TEST RESULTS - Task #014')
    console.log('='.repeat(60))
    
    console.log(`\n🎯 SLO Targets:`)
    console.log(`   Availability: ≥99.5%`)
    console.log(`   P95 Response Time: ≤1500ms`)
    console.log(`   Concurrent Users: ${this.config.concurrent}`)
    console.log(`   Test Duration: ${this.config.duration}s`)
    
    console.log(`\n📈 Performance Metrics:`)
    console.log(`   Total Requests: ${results.totalRequests.toLocaleString()}`)
    console.log(`   Successful Requests: ${results.successfulRequests.toLocaleString()}`)
    console.log(`   Failed Requests: ${results.failedRequests.toLocaleString()}`)
    console.log(`   Requests/sec: ${results.requestsPerSecond.toFixed(2)}`)
    
    console.log(`\n⏱️  Response Times:`)
    console.log(`   Average: ${results.averageResponseTime.toFixed(2)}ms`)
    console.log(`   P95: ${results.p95ResponseTime.toFixed(2)}ms`)
    console.log(`   P99: ${results.p99ResponseTime.toFixed(2)}ms`)
    console.log(`   Min: ${results.minResponseTime.toFixed(2)}ms`)
    console.log(`   Max: ${results.maxResponseTime.toFixed(2)}ms`)
    
    const availabilityStatus = results.availability >= 99.5 ? '✅' : '❌'
    const p95Status = results.p95ResponseTime <= 1500 ? '✅' : '❌'
    
    console.log(`\n🎯 SLO Achievement:`)
    console.log(`   ${availabilityStatus} Availability: ${results.availability.toFixed(3)}% (Target: ≥99.5%)`)
    console.log(`   ${p95Status} P95 Response Time: ${results.p95ResponseTime.toFixed(2)}ms (Target: ≤1500ms)`)
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`)
      results.errors.forEach(error => {
        console.log(`   ${error.error}: ${error.count} occurrences`)
      })
    }
    
    const overallStatus = results.availability >= 99.5 && results.p95ResponseTime <= 1500
    console.log(`\n${overallStatus ? '🎉' : '⚠️ '} Overall Status: ${overallStatus ? 'PASSED - SLO targets achieved!' : 'FAILED - SLO targets not met'}`)
    console.log('='.repeat(60))
  }

  async run(): Promise<boolean> {
    console.log(`🚀 Starting load test with ${this.config.concurrent} concurrent users for ${this.config.duration}s`)
    console.log(`📡 Target URL: ${this.config.baseUrl}`)
    console.log(`⏳ Ramp-up time: ${this.config.rampUpTime}s`)
    
    this.startTime = Date.now()
    
    // Start ramp-up
    await this.rampUp()
    
    // Wait for test completion + buffer for ongoing requests
    await new Promise(resolve => setTimeout(resolve, (this.config.duration + this.config.rampUpTime + 10) * 1000))
    
    // Wait for any remaining requests to complete
    while (this.activeRequests > 0) {
      console.log(`⏳ Waiting for ${this.activeRequests} active requests to complete...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const results = this.calculateResults()
    this.printResults(results)
    
    // Return whether SLO targets were met
    return results.availability >= 99.5 && results.p95ResponseTime <= 1500
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const config: LoadTestConfig = {
    baseUrl: args.find(arg => arg.startsWith('--baseUrl='))?.split('=')[1] || 'http://localhost:3000',
    concurrent: parseInt(args.find(arg => arg.startsWith('--concurrent='))?.split('=')[1] || '10'),
    duration: parseInt(args.find(arg => arg.startsWith('--duration='))?.split('=')[1] || '60'),
    rampUpTime: parseInt(args.find(arg => arg.startsWith('--rampUp='))?.split('=')[1] || '30'),
    scenarios: []
  }
  
  const loadTest = new LoadTest(config)
  config.scenarios = loadTest['getTestScenarios']() // Access private method for initialization
  
  try {
    const success = await loadTest.run()
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('❌ Load test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { LoadTest, type LoadTestConfig, type TestResult }
