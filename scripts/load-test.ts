/**
 * Load Testing Script for Performance Validation
 * Task #014: 性能・p95最適化実装 - 100CCU負荷・99.5%可用性検証
 * 
 * Usage:
 * npm run test:load
 * npm run test:load -- --concurrent=50 --duration=300
 */

import { performance } from 'perf_hooks'

interface LoadTestConfig {
  baseUrl: string
  concurrent: number
  duration: number // seconds
  warmup: number // seconds
  endpoints: TestEndpoint[]
}

interface TestEndpoint {
  path: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  weight: number // Probability weight for this endpoint
}

interface TestResult {
  endpoint: string
  timestamp: number
  responseTime: number
  status: number
  success: boolean
  error?: string
}

interface LoadTestResults {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  requestsPerSecond: number
  availability: number
  errorRate: number
  testDuration: number
  concurrentUsers: number
  sloAchieved: boolean
}

class LoadTester {
  private config: LoadTestConfig
  private results: TestResult[] = []
  private running = false
  private authToken?: string

  constructor(config: LoadTestConfig) {
    this.config = config
  }

  /**
   * Authenticate and get session token
   */
  async authenticate(): Promise<void> {
    try {
      // Use test credentials from environment
      const email = process.env.TEST_USER_EMAIL || 'test@example.com'
      const response = await fetch(`${this.config.baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        console.log('✅ Authentication successful')
        // Note: In real scenarios, you'd extract token from response
        this.authToken = 'test-session-token'
      } else {
        console.warn('⚠️  Authentication failed, proceeding without auth')
      }
    } catch (error) {
      console.warn('⚠️  Authentication error:', error)
    }
  }

  /**
   * Execute single HTTP request
   */
  async executeRequest(endpoint: TestEndpoint): Promise<TestResult> {
    const startTime = performance.now()
    const timestamp = Date.now()

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'LoadTest/1.0',
        'Accept': 'application/json',
        ...endpoint.headers
      }

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers,
        body: endpoint.body,
        signal: AbortSignal.timeout(10000) // 10s timeout
      })

      const responseTime = performance.now() - startTime

      return {
        endpoint: endpoint.path,
        timestamp,
        responseTime,
        status: response.status,
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`
      }
    } catch (error) {
      const responseTime = performance.now() - startTime
      return {
        endpoint: endpoint.path,
        timestamp,
        responseTime,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Select random endpoint based on weights
   */
  selectEndpoint(): TestEndpoint {
    const totalWeight = this.config.endpoints.reduce((sum, ep) => sum + ep.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const endpoint of this.config.endpoints) {
      random -= endpoint.weight
      if (random <= 0) {
        return endpoint
      }
    }
    
    return this.config.endpoints[0] // Fallback
  }

  /**
   * Simulate single user session
   */
  async simulateUser(userId: number): Promise<void> {
    const userStartTime = performance.now()
    const endTime = userStartTime + (this.config.duration * 1000)

    console.log(`👤 User ${userId} started`)

    while (this.running && performance.now() < endTime) {
      const endpoint = this.selectEndpoint()
      const result = await this.executeRequest(endpoint)
      this.results.push(result)

      // Random think time between requests (100ms - 2s)
      const thinkTime = Math.random() * 1900 + 100
      await new Promise(resolve => setTimeout(resolve, thinkTime))
    }

    console.log(`👤 User ${userId} completed`)
  }

  /**
   * Run warmup phase
   */
  async warmup(): Promise<void> {
    if (this.config.warmup <= 0) return

    console.log(`🔥 Warming up for ${this.config.warmup} seconds...`)
    
    const warmupRequests = Math.min(this.config.concurrent, 10)
    const warmupPromises = []

    for (let i = 0; i < warmupRequests; i++) {
      warmupPromises.push(this.executeRequest(this.config.endpoints[0]))
    }

    await Promise.all(warmupPromises)
    await new Promise(resolve => setTimeout(resolve, this.config.warmup * 1000))
    
    console.log('✅ Warmup completed')
  }

  /**
   * Execute load test
   */
  async run(): Promise<LoadTestResults> {
    console.log(`🚀 Starting load test`)
    console.log(`📊 Configuration:`)
    console.log(`   - Base URL: ${this.config.baseUrl}`)
    console.log(`   - Concurrent Users: ${this.config.concurrent}`)
    console.log(`   - Duration: ${this.config.duration}s`)
    console.log(`   - Endpoints: ${this.config.endpoints.length}`)

    // Authentication
    await this.authenticate()

    // Warmup
    await this.warmup()

    // Reset results
    this.results = []
    this.running = true

    const testStartTime = performance.now()

    // Start concurrent user sessions
    const userPromises = []
    for (let i = 1; i <= this.config.concurrent; i++) {
      userPromises.push(this.simulateUser(i))
      
      // Gradual ramp-up over first 10% of test duration
      if (i < this.config.concurrent) {
        const rampUpDelay = (this.config.duration * 100) / this.config.concurrent
        await new Promise(resolve => setTimeout(resolve, rampUpDelay))
      }
    }

    // Wait for all users to complete
    await Promise.all(userPromises)
    
    this.running = false
    const testEndTime = performance.now()
    const actualDuration = (testEndTime - testStartTime) / 1000

    console.log(`✅ Load test completed in ${actualDuration.toFixed(2)}s`)

    return this.analyzeResults(actualDuration)
  }

  /**
   * Analyze test results and calculate metrics
   */
  private analyzeResults(actualDuration: number): LoadTestResults {
    const successfulResults = this.results.filter(r => r.success)
    const failedResults = this.results.filter(r => !r.success)
    
    const responseTimes = successfulResults.map(r => r.responseTime).sort((a, b) => a - b)
    
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0

    const availability = this.results.length > 0 
      ? (successfulResults.length / this.results.length) * 100 
      : 0

    const errorRate = this.results.length > 0 
      ? (failedResults.length / this.results.length) * 100 
      : 0

    const requestsPerSecond = actualDuration > 0 
      ? this.results.length / actualDuration 
      : 0

    const p95ResponseTime = responseTimes[p95Index] || 0
    
    // SLO targets: 99.5% availability, p95 ≤ 1500ms
    const sloAchieved = availability >= 99.5 && p95ResponseTime <= 1500

    return {
      totalRequests: this.results.length,
      successfulRequests: successfulResults.length,
      failedRequests: failedResults.length,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime: responseTimes[p99Index] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      minResponseTime: responseTimes[0] || 0,
      requestsPerSecond,
      availability,
      errorRate,
      testDuration: actualDuration,
      concurrentUsers: this.config.concurrent,
      sloAchieved
    }
  }

  /**
   * Print detailed results
   */
  printResults(results: LoadTestResults): void {
    console.log('\n📊 LOAD TEST RESULTS')
    console.log('==========================================')
    
    console.log(`\n🎯 SLO Achievement: ${results.sloAchieved ? '✅ PASSED' : '❌ FAILED'}`)
    
    console.log(`\n📈 Performance Metrics:`)
    console.log(`   - Total Requests: ${results.totalRequests.toLocaleString()}`)
    console.log(`   - Successful: ${results.successfulRequests.toLocaleString()} (${results.availability.toFixed(2)}%)`)
    console.log(`   - Failed: ${results.failedRequests.toLocaleString()} (${results.errorRate.toFixed(2)}%)`)
    console.log(`   - Requests/sec: ${results.requestsPerSecond.toFixed(2)}`)
    
    console.log(`\n⏱️  Response Times:`)
    console.log(`   - Average: ${results.averageResponseTime.toFixed(2)}ms`)
    console.log(`   - P95: ${results.p95ResponseTime.toFixed(2)}ms ${results.p95ResponseTime <= 1500 ? '✅' : '❌'}`)
    console.log(`   - P99: ${results.p99ResponseTime.toFixed(2)}ms`)
    console.log(`   - Min: ${results.minResponseTime.toFixed(2)}ms`)
    console.log(`   - Max: ${results.maxResponseTime.toFixed(2)}ms`)
    
    console.log(`\n🔍 Test Configuration:`)
    console.log(`   - Concurrent Users: ${results.concurrentUsers}`)
    console.log(`   - Test Duration: ${results.testDuration.toFixed(2)}s`)
    console.log(`   - Availability Target: 99.5% ${results.availability >= 99.5 ? '✅' : '❌'}`)
    console.log(`   - P95 Target: ≤1500ms ${results.p95ResponseTime <= 1500 ? '✅' : '❌'}`)

    if (!results.sloAchieved) {
      console.log(`\n⚠️  SLO NOT ACHIEVED:`)
      if (results.availability < 99.5) {
        console.log(`   - Availability: ${results.availability.toFixed(2)}% < 99.5%`)
      }
      if (results.p95ResponseTime > 1500) {
        console.log(`   - P95 Response Time: ${results.p95ResponseTime.toFixed(2)}ms > 1500ms`)
      }
    }

    // Error analysis
    if (results.failedRequests > 0) {
      console.log(`\n❌ Error Analysis:`)
      const errorTypes = new Map<string, number>()
      
      this.results.filter(r => !r.success).forEach(r => {
        const errorKey = r.error || 'Unknown'
        errorTypes.set(errorKey, (errorTypes.get(errorKey) || 0) + 1)
      })

      for (const [error, count] of errorTypes.entries()) {
        console.log(`   - ${error}: ${count} occurrences`)
      }
    }
  }
}

// Default test configuration
const DEFAULT_CONFIG: LoadTestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  concurrent: 100,
  duration: 1800, // 30 minutes
  warmup: 30,
  endpoints: [
    {
      path: '/api/analytics?start=2025-01-01&end=2025-01-31',
      method: 'GET',
      weight: 40 // 40% of requests
    },
    {
      path: '/api/analytics/correlation',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          dateRange: { start: '2025-01-01', end: '2025-01-31' }
        }
      }),
      weight: 20 // 20% of requests
    },
    {
      path: '/api/sales',
      method: 'GET',
      weight: 25 // 25% of requests
    },
    {
      path: '/api/export',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sales',
        filters: {
          dateRange: { start: '2025-01-01', end: '2025-01-07' }
        }
      }),
      weight: 10 // 10% of requests
    },
    {
      path: '/api/audit',
      method: 'GET',
      weight: 5 // 5% of requests
    }
  ]
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const config = { ...DEFAULT_CONFIG }

  // Parse CLI arguments
  for (const arg of args) {
    if (arg.startsWith('--concurrent=')) {
      config.concurrent = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--duration=')) {
      config.duration = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--baseUrl=')) {
      config.baseUrl = arg.split('=')[1]
    }
  }

  const tester = new LoadTester(config)
  
  try {
    const results = await tester.run()
    tester.printResults(results)
    
    // Exit with error code if SLO not achieved
    process.exit(results.sloAchieved ? 0 : 1)
  } catch (error) {
    console.error('❌ Load test failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { LoadTester, LoadTestConfig, LoadTestResults }
