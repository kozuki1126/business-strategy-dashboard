#!/usr/bin/env node

/**
 * Performance Testing CLI
 * Task #014: 性能・p95最適化実装 - CLIツール
 * Usage: npm run perf:test [smoke|slo|full]
 */

const { runSLOVerificationTest, runSmokeTest, generateLoadTestReport } = require('../dist/lib/performance/load-test.js')

async function main() {
  const testType = process.argv[2] || 'smoke'
  
  console.log('🚀 Business Strategy Dashboard - Performance Testing CLI')
  console.log('=' .repeat(60))
  
  try {
    let result
    
    switch (testType) {
      case 'smoke':
        console.log('🔍 Running Performance Smoke Test (2min, 10CCU)')
        result = await runSmokeTest()
        break
        
      case 'slo':
        console.log('⚡ Running SLO Verification Test (30min, 100CCU)')
        console.log('⚠️  WARNING: This is a long-running test')
        result = await runSLOVerificationTest()
        break
        
      case 'full':
        console.log('🎯 Running Full Performance Suite')
        console.log('1/2 Smoke Test...')
        const smokeResult = await runSmokeTest()
        
        if (smokeResult.passed) {
          console.log('✅ Smoke test passed, proceeding with SLO test...')
          console.log('2/2 SLO Verification Test...')
          result = await runSLOVerificationTest()
        } else {
          console.log('❌ Smoke test failed, skipping SLO test')
          result = smokeResult
        }
        break
        
      default:
        console.error('❌ Invalid test type. Use: smoke, slo, or full')
        process.exit(1)
    }
    
    // Final result
    console.log('\n' + '=' .repeat(60))
    console.log('📋 FINAL RESULT')
    console.log('=' .repeat(60))
    
    if (result.passed) {
      console.log('🎉 PERFORMANCE TEST PASSED!')
      console.log(`✅ Availability: ${result.metrics.availability.toFixed(2)}%`)
      console.log(`✅ P95 Response: ${result.metrics.responseTimeP95.toFixed(0)}ms`)
      console.log(`✅ Error Rate: ${result.metrics.errorRate.toFixed(2)}%`)
      process.exit(0)
    } else {
      console.log('💥 PERFORMANCE TEST FAILED!')
      console.log('Violations:')
      result.violations.forEach(v => console.log(`  ❌ ${v}`))
      console.log('\nRecommendations:')
      result.recommendations.forEach(r => console.log(`  💡 ${r}`))
      process.exit(1)
    }
    
  } catch (error) {
    console.error('💥 Performance test crashed:', error.message)
    
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack)
    }
    
    process.exit(1)
  }
}

// Add helpful usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Performance Testing CLI for Business Strategy Dashboard

USAGE:
  npm run perf:test [TEST_TYPE]

TEST TYPES:
  smoke    Quick smoke test (2min, 10CCU) - Default
  slo      Full SLO verification test (30min, 100CCU)
  full     Run smoke test first, then SLO if passing

EXAMPLES:
  npm run perf:test
  npm run perf:test smoke
  npm run perf:test slo
  npm run perf:test full

ENVIRONMENT:
  Set NEXT_PUBLIC_APP_URL to test different environments
  Default: http://localhost:3000

SLO TARGETS:
  - Availability: ≥99.5%
  - P95 Response Time: ≤1500ms
  - Error Rate: ≤0.5%
  - Concurrent Users: 100CCU for 30min

REPORTS:
  Test results are logged to console and can be captured:
  npm run perf:test slo 2>&1 | tee performance-report.log
`)
  process.exit(0)
}

main()
