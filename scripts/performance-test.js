#!/usr/bin/env node

/**
 * Performance Test Suite for Task #014 - Performance Optimization
 * Supports smoke tests, SLO validation, and full performance testing
 */

const { performance } = require('perf_hooks')
const { createHash } = require('crypto')

class PerformanceTest {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl
    this.results = []
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      errors: []
    }
  }

  async makeRequest(endpoint, options = {}) {
    const startTime = performance.now()
    const startMemory = process.memoryUsage().heapUsed
    
    try {
      const url = `${this.baseUrl}${endpoint}`
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'PerformanceTest/1.0',
          'Accept': 'application/json',
          ...options.headers
        },
        body: options.body
      })

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed
      
      const result = {
        endpoint,
        success: response.ok,
        status: response.status,
        responseTime: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        timestamp: Date.now()
      }

      this.results.push(result)
      this.metrics.responseTime.push(result.responseTime)
      
      if (!response.ok) {
        this.metrics.errors.push({
          endpoint,
          status: response.status,
          error: response.statusText
        })
      }

      return result
    } catch (error) {
      const endTime = performance.now()
      const result = {
        endpoint,
        success: false,
        status: 0,
        responseTime: endTime - startTime,
        memoryDelta: 0,
        timestamp: Date.now(),
        error: error.message
      }

      this.results.push(result)
      this.metrics.errors.push({
        endpoint,
        status: 0,
        error: error.message
      })

      return result
    }
  }

  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index] || 0
  }

  getMetrics() {
    const responseTimes = this.metrics.responseTime
    const successfulRequests = this.results.filter(r => r.success).length
    const totalRequests = this.results.length
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      availability: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      p50ResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      errors: this.metrics.errors
    }
  }

  async smokeTest() {
    console.log('🔥 Running smoke tests...')
    
    const endpoints = [
      '/',
      '/dashboard',
      '/api/sales',
      '/api/analytics',
      '/api/audit'
    ]

    for (const endpoint of endpoints) {
      console.log(`   Testing ${endpoint}...`)
      await this.makeRequest(endpoint)
      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay
    }

    const metrics = this.getMetrics()
    
    console.log('\n📊 Smoke Test Results:')
    console.log(`   Requests: ${metrics.totalRequests}`)
    console.log(`   Success Rate: ${metrics.availability.toFixed(2)}%`)
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`   P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms`)
    
    if (metrics.errors.length > 0) {
      console.log(`\n❌ Errors:`)
      metrics.errors.forEach(error => {
        console.log(`   ${error.endpoint}: ${error.status} - ${error.error}`)
      })
    }

    const passed = metrics.availability >= 95 && metrics.p95ResponseTime <= 2000
    console.log(`\n${passed ? '✅' : '❌'} Smoke test ${passed ? 'PASSED' : 'FAILED'}`)
    
    return passed
  }

  async sloValidation() {
    console.log('🎯 Running SLO validation tests...')
    
    const testDuration = 300000 // 5 minutes
    const targetConcurrency = 10
    const sloTargets = {
      availability: 99.5,
      p95ResponseTime: 1500
    }

    console.log(`   Duration: ${testDuration / 1000}s`)
    console.log(`   Concurrency: ${targetConcurrency}`)
    console.log(`   SLO Targets: ${sloTargets.availability}% availability, P95≤${sloTargets.p95ResponseTime}ms`)

    const startTime = Date.now()
    const endTime = startTime + testDuration
    const userPromises = []

    // Start concurrent users
    for (let i = 0; i < targetConcurrency; i++) {
      userPromises.push(this.simulateUser(endTime))
    }

    // Wait for all users to complete
    await Promise.all(userPromises)

    const metrics = this.getMetrics()
    
    console.log('\n📈 SLO Validation Results:')
    console.log(`   Total Requests: ${metrics.totalRequests}`)
    console.log(`   Successful Requests: ${metrics.successfulRequests}`)
    console.log(`   Failed Requests: ${metrics.failedRequests}`)
    console.log(`   Availability: ${metrics.availability.toFixed(3)}%`)
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`   P50 Response Time: ${metrics.p50ResponseTime.toFixed(2)}ms`)
    console.log(`   P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms`)
    console.log(`   P99 Response Time: ${metrics.p99ResponseTime.toFixed(2)}ms`)

    const availabilityMet = metrics.availability >= sloTargets.availability
    const p95Met = metrics.p95ResponseTime <= sloTargets.p95ResponseTime

    console.log(`\n🎯 SLO Achievement:`)
    console.log(`   ${availabilityMet ? '✅' : '❌'} Availability: ${metrics.availability.toFixed(3)}% (Target: ≥${sloTargets.availability}%)`)
    console.log(`   ${p95Met ? '✅' : '❌'} P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms (Target: ≤${sloTargets.p95ResponseTime}ms)`)

    if (metrics.errors.length > 0) {
      console.log(`\n❌ Error Summary:`)
      const errorCounts = {}
      metrics.errors.forEach(error => {
        const key = `${error.status} - ${error.error}`
        errorCounts[key] = (errorCounts[key] || 0) + 1
      })
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} occurrences`)
      })
    }

    const sloMet = availabilityMet && p95Met
    console.log(`\n${sloMet ? '🎉' : '⚠️ '} SLO validation ${sloMet ? 'PASSED' : 'FAILED'}`)
    
    return sloMet
  }

  async simulateUser(endTime) {
    const endpoints = [
      { path: '/dashboard', weight: 40 },
      { path: '/api/analytics', weight: 25 },
      { path: '/api/sales', weight: 20 },
      { path: '/api/audit', weight: 10 },
      { path: '/api/export', weight: 5 }
    ]

    while (Date.now() < endTime) {
      // Select random endpoint based on weight
      const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0)
      const random = Math.random() * totalWeight
      let currentWeight = 0
      let selectedEndpoint = endpoints[0].path

      for (const endpoint of endpoints) {
        currentWeight += endpoint.weight
        if (random <= currentWeight) {
          selectedEndpoint = endpoint.path
          break
        }
      }

      await this.makeRequest(selectedEndpoint)
      
      // Random think time between 1-3 seconds
      const thinkTime = Math.random() * 2000 + 1000
      await new Promise(resolve => setTimeout(resolve, thinkTime))
    }
  }

  async fullLoadTest() {
    console.log('🚀 Running full load test...')
    console.log('   This will take 30 minutes with 100 concurrent users')
    console.log('   For production testing, use: npm run test:load:production')
    
    // For local testing, use reduced parameters
    const testDuration = 1800000 // 30 minutes
    const targetConcurrency = 50 // Reduced for local testing
    
    console.log(`\n📊 Test Configuration:`)
    console.log(`   Duration: ${testDuration / 60000} minutes`)
    console.log(`   Concurrent Users: ${targetConcurrency}`)
    console.log(`   Target: 99.5% availability, P95≤1500ms`)

    const startTime = Date.now()
    const endTime = startTime + testDuration
    const userPromises = []

    // Start concurrent users
    for (let i = 0; i < targetConcurrency; i++) {
      userPromises.push(this.simulateUser(endTime))
    }

    // Progress reporting every 5 minutes
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = endTime - Date.now()
      const progress = (elapsed / testDuration) * 100
      
      console.log(`⏳ Progress: ${progress.toFixed(1)}% (${Math.round(remaining / 60000)} minutes remaining)`)
      
      if (this.results.length > 0) {
        const recentMetrics = this.getMetrics()
        console.log(`   Current P95: ${recentMetrics.p95ResponseTime.toFixed(2)}ms, Availability: ${recentMetrics.availability.toFixed(2)}%`)
      }
    }, 300000) // Every 5 minutes

    // Wait for all users to complete
    await Promise.all(userPromises)
    clearInterval(progressInterval)

    const metrics = this.getMetrics()
    
    console.log('\n' + '='.repeat(60))
    console.log('🏁 FULL LOAD TEST RESULTS - Task #014')
    console.log('='.repeat(60))
    
    console.log(`\n📊 Performance Metrics:`)
    console.log(`   Total Requests: ${metrics.totalRequests.toLocaleString()}`)
    console.log(`   Successful Requests: ${metrics.successfulRequests.toLocaleString()}`)
    console.log(`   Failed Requests: ${metrics.failedRequests.toLocaleString()}`)
    console.log(`   Test Duration: ${(testDuration / 60000).toFixed(1)} minutes`)
    console.log(`   Requests/minute: ${((metrics.totalRequests / (testDuration / 60000)).toFixed(0))}`)
    
    console.log(`\n⏱️  Response Time Analysis:`)
    console.log(`   Average: ${metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`   P50: ${metrics.p50ResponseTime.toFixed(2)}ms`)
    console.log(`   P95: ${metrics.p95ResponseTime.toFixed(2)}ms`)
    console.log(`   P99: ${metrics.p99ResponseTime.toFixed(2)}ms`)
    console.log(`   Min: ${metrics.minResponseTime.toFixed(2)}ms`)
    console.log(`   Max: ${metrics.maxResponseTime.toFixed(2)}ms`)

    const availabilityMet = metrics.availability >= 99.5
    const p95Met = metrics.p95ResponseTime <= 1500

    console.log(`\n🎯 SLO Achievement:`)
    console.log(`   ${availabilityMet ? '✅' : '❌'} Availability: ${metrics.availability.toFixed(3)}% (Target: ≥99.5%)`)
    console.log(`   ${p95Met ? '✅' : '❌'} P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms (Target: ≤1500ms)`)

    const allTargetsMet = availabilityMet && p95Met
    console.log(`\n${allTargetsMet ? '🎉' : '⚠️ '} Load test ${allTargetsMet ? 'PASSED - All SLO targets achieved!' : 'FAILED - SLO targets not met'}`)
    console.log('='.repeat(60))
    
    return allTargetsMet
  }
}

// Main execution
async function main() {
  const testType = process.argv[2] || 'smoke'
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
  
  console.log(`🧪 Performance Testing - Task #014`)
  console.log(`📡 Target URL: ${baseUrl}`)
  console.log(`🔬 Test Type: ${testType}`)
  console.log('')

  const tester = new PerformanceTest(baseUrl)
  let success = false

  try {
    switch (testType) {
      case 'smoke':
        success = await tester.smokeTest()
        break
      case 'slo':
        success = await tester.sloValidation()
        break
      case 'full':
        success = await tester.fullLoadTest()
        break
      default:
        console.error(`❌ Unknown test type: ${testType}`)
        console.error(`Available types: smoke, slo, full`)
        process.exit(1)
    }

    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { PerformanceTest }
