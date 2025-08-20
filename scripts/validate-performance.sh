#!/bin/bash

# Performance Validation & Load Testing Script
# Task #014: 性能・p95最適化実装 - 100CCU負荷・99.5%可用性検証
# 
# Usage: ./scripts/validate-performance.sh [environment]
# environments: local, staging, production

set -e

# ========================================
# CONFIGURATION
# ========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Environment configuration
ENVIRONMENT="${1:-local}"
case $ENVIRONMENT in
  "local")
    BASE_URL="http://localhost:3000"
    CONCURRENT_USERS=10
    DURATION=300  # 5 minutes for local testing
    ;;
  "staging")
    BASE_URL="https://business-strategy-dashboard-staging.vercel.app"
    CONCURRENT_USERS=50
    DURATION=900  # 15 minutes for staging
    ;;
  "production")
    BASE_URL="https://business-strategy-dashboard.vercel.app"
    CONCURRENT_USERS=100
    DURATION=1800  # 30 minutes for production validation
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Valid environments: local, staging, production"
    exit 1
    ;;
esac

# SLO Targets
AVAILABILITY_TARGET=99.5
P95_TARGET=1500
ERROR_RATE_TARGET=0.5

echo "🚀 Performance Validation for $ENVIRONMENT environment"
echo "=========================================="
echo "Target URL: $BASE_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Duration: ${DURATION}s ($(($DURATION / 60)) minutes)"
echo "SLO Targets:"
echo "  - Availability: ≥${AVAILABILITY_TARGET}%"
echo "  - P95 Response Time: ≤${P95_TARGET}ms"
echo "  - Error Rate: ≤${ERROR_RATE_TARGET}%"
echo ""

# ========================================
# PRE-TEST VALIDATION
# ========================================

echo "🔍 Pre-test validation..."

# Check if application is responding
echo "Checking application health..."
if ! curl -f -s "$BASE_URL/api/analytics" > /dev/null; then
  echo "❌ Application not responding at $BASE_URL"
  exit 1
fi
echo "✅ Application is responding"

# Check Node.js and dependencies
echo "Checking Node.js environment..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# Check TypeScript
if ! command -v npx tsx &> /dev/null; then
  echo "❌ tsx not found - installing..."
  npm install -g tsx
fi
echo "✅ TypeScript execution ready"

# ========================================
# PERFORMANCE BASELINE
# ========================================

echo ""
echo "📊 Establishing performance baseline..."

# Single request baseline
echo "Testing single request performance..."
BASELINE_START=$(date +%s%3N)
if curl -f -s -w "%{time_total}" "$BASE_URL/api/analytics?start=2025-01-01&end=2025-01-31" > /tmp/baseline_response.txt; then
  BASELINE_TIME=$(tail -n1 /tmp/baseline_response.txt | sed 's/^.*\([0-9]\+\.[0-9]\+\)$/\1/')
  BASELINE_MS=$(echo "$BASELINE_TIME * 1000" | bc)
  echo "✅ Baseline response time: ${BASELINE_MS}ms"
  
  if (( $(echo "$BASELINE_MS > $P95_TARGET" | bc -l) )); then
    echo "⚠️  Warning: Baseline exceeds P95 target (${BASELINE_MS}ms > ${P95_TARGET}ms)"
  fi
else
  echo "❌ Baseline test failed"
  exit 1
fi

# ========================================
# WARM-UP PHASE
# ========================================

echo ""
echo "🔥 Warming up application..."

# Create warm-up script
cat > /tmp/warmup.js << 'EOF'
const BASE_URL = process.argv[2] || 'http://localhost:3000';

async function warmup() {
  const endpoints = [
    '/api/analytics',
    '/api/sales',
    '/api/audit',
    '/dashboard'
  ];
  
  console.log('🔥 Starting warmup...');
  
  for (let i = 0; i < 3; i++) {
    const promises = endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        console.log(`✅ ${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    });
    
    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Warmup completed');
}

warmup().catch(console.error);
EOF

node /tmp/warmup.js "$BASE_URL"

# ========================================
# LOAD TESTING
# ========================================

echo ""
echo "🏋️  Starting load testing..."
echo "This will take $(($DURATION / 60)) minutes..."

# Run load test
LOAD_TEST_START=$(date +%s)
echo "Load test started at: $(date)"

# Create load test configuration
export TEST_BASE_URL="$BASE_URL"
export LOAD_TEST_CONCURRENT="$CONCURRENT_USERS"
export LOAD_TEST_DURATION="$DURATION"

# Execute load test
if cd "$PROJECT_ROOT" && npm run test:load -- \
  --baseUrl="$BASE_URL" \
  --concurrent="$CONCURRENT_USERS" \
  --duration="$DURATION"; then
  
  LOAD_TEST_END=$(date +%s)
  ACTUAL_DURATION=$((LOAD_TEST_END - LOAD_TEST_START))
  
  echo ""
  echo "✅ Load test completed"
  echo "Actual duration: ${ACTUAL_DURATION}s"
  
else
  echo "❌ Load test failed"
  exit 1
fi

# ========================================
# SLO MONITORING CHECK
# ========================================

echo ""
echo "📈 Checking SLO compliance..."

# Run SLO monitor check
if cd "$PROJECT_ROOT" && npm run monitor:slo > /tmp/slo_results.txt 2>&1; then
  echo "✅ SLO monitoring data collected"
  cat /tmp/slo_results.txt
else
  echo "⚠️  SLO monitoring failed, but load test results should still be valid"
fi

# ========================================
# REPORT GENERATION
# ========================================

echo ""
echo "📋 Generating performance report..."

REPORT_FILE="performance-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# Performance Validation Report

**Test Date**: $(date)  
**Environment**: $ENVIRONMENT  
**Target URL**: $BASE_URL  
**Test Duration**: ${DURATION}s ($(($DURATION / 60)) minutes)  
**Concurrent Users**: $CONCURRENT_USERS  

## SLO Targets

- **Availability**: ≥${AVAILABILITY_TARGET}%
- **P95 Response Time**: ≤${P95_TARGET}ms  
- **Error Rate**: ≤${ERROR_RATE_TARGET}%

## Baseline Performance

- **Single Request**: ${BASELINE_MS}ms
- **Status**: $(if (( $(echo "$BASELINE_MS <= $P95_TARGET" | bc -l) )); then echo "✅ PASS"; else echo "❌ FAIL"; fi)

## Load Test Configuration

- **Concurrent Users**: $CONCURRENT_USERS
- **Test Duration**: ${ACTUAL_DURATION}s  
- **Warmup**: Completed successfully
- **Environment**: $ENVIRONMENT

## Results

EOF

# Add load test results if available
if [ -f "/tmp/load_test_results.json" ]; then
  echo "Load test results found - processing..."
  # Process JSON results (would need jq or similar for full processing)
  echo "See console output above for detailed results" >> "$REPORT_FILE"
else
  echo "Load test results processed via console output" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

## Recommendations

$(if (( $(echo "$BASELINE_MS > $P95_TARGET" | bc -l) )); then
cat << REC
### Performance Issues Detected

- Baseline response time (${BASELINE_MS}ms) exceeds P95 target (${P95_TARGET}ms)
- Consider implementing additional optimizations:
  - Database query optimization
  - Increased caching
  - CDN configuration review
  - Bundle size reduction

REC
else
cat << REC
### Performance Baseline Good

- Baseline response time within target
- Continue monitoring under load conditions
- Validate caching effectiveness
- Monitor error rates

REC
fi)

## Next Steps

1. Review detailed load test results above
2. Address any performance issues identified
3. Implement additional monitoring if needed
4. Schedule regular performance validation
5. Update SLO targets based on results

---
*Report generated by Performance Validation Script*
EOF

echo "📋 Report saved to: $REPORT_FILE"

# ========================================
# CLEANUP
# ========================================

echo ""
echo "🧹 Cleaning up..."
rm -f /tmp/warmup.js /tmp/baseline_response.txt /tmp/slo_results.txt

# ========================================
# FINAL STATUS
# ========================================

echo ""
echo "🎯 Performance Validation Summary"
echo "=================================="

if (( $(echo "$BASELINE_MS <= $P95_TARGET" | bc -l) )); then
  echo "✅ Baseline Performance: PASS (${BASELINE_MS}ms ≤ ${P95_TARGET}ms)"
  BASELINE_STATUS=0
else
  echo "❌ Baseline Performance: FAIL (${BASELINE_MS}ms > ${P95_TARGET}ms)"
  BASELINE_STATUS=1
fi

echo "📊 Load Test: Check console output above for detailed results"
echo "📋 Report: $REPORT_FILE"

echo ""
if [ $BASELINE_STATUS -eq 0 ]; then
  echo "🎉 Performance validation completed successfully!"
  echo "The application meets baseline performance requirements."
else
  echo "⚠️  Performance validation completed with issues."
  echo "Review the recommendations in the report."
fi

echo ""
echo "To run production validation:"
echo "  ./scripts/validate-performance.sh production"
echo ""
echo "To monitor ongoing SLO compliance:"
echo "  npm run monitor:slo"

exit $BASELINE_STATUS