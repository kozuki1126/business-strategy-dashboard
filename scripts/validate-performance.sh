#!/bin/bash

# Performance Validation Script for Task #014
# Target: 100CCU負荷・99.5%可用性・p95≤1500ms
# Usage: ./scripts/validate-performance.sh [environment]

set -e

# ========================================
# CONFIGURATION
# ========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="$PROJECT_ROOT/performance-reports"
ENVIRONMENT=${1:-"development"}

# Performance thresholds
SLO_AVAILABILITY=99.5
SLO_P95_RESPONSE_TIME=1500
TARGET_CONCURRENT_USERS=100
TEST_DURATION=1800  # 30 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# HELPER FUNCTIONS
# ========================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create report directory
mkdir -p "$REPORT_DIR"

# ========================================
# ENVIRONMENT SETUP
# ========================================

setup_environment() {
    log "Setting up environment for performance testing..."
    
    case $ENVIRONMENT in
        "production")
            BASE_URL="https://business-strategy-dashboard.vercel.app"
            log "Using production environment: $BASE_URL"
            ;;
        "staging")
            BASE_URL="https://business-strategy-dashboard-staging.vercel.app"
            log "Using staging environment: $BASE_URL"
            ;;
        "development")
            BASE_URL="http://localhost:3000"
            log "Using development environment: $BASE_URL"
            
            # Check if local server is running
            if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
                error "Local development server is not running!"
                error "Please start the server with: npm run dev"
                exit 1
            fi
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            error "Supported environments: development, staging, production"
            exit 1
            ;;
    esac
    
    success "Environment setup completed"
}

# ========================================
# PRE-FLIGHT CHECKS
# ========================================

preflight_checks() {
    log "Running pre-flight checks..."
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    success "Node.js $(node --version) and npm $(npm --version) are available"
    
    # Check required dependencies
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        error "package.json not found in project root"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log "Installing dependencies..."
        cd "$PROJECT_ROOT"
        npm install
        success "Dependencies installed"
    fi
    
    # Check if required scripts exist
    local required_scripts=("bundle-optimizer.ts" "load-test.ts" "performance-test.js")
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            error "Required script not found: $script"
            exit 1
        fi
    done
    
    success "All required scripts are available"
}

# ========================================
# BUILD AND BUNDLE ANALYSIS
# ========================================

analyze_bundle() {
    log "Analyzing bundle size and optimization..."
    
    cd "$PROJECT_ROOT"
    
    # Build the application
    log "Building application..."
    npm run build 2>&1 | tee "$REPORT_DIR/build-$TIMESTAMP.log"
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        error "Build failed! Check build log for details."
        exit 1
    fi
    
    success "Build completed successfully"
    
    # Bundle analysis
    log "Running bundle analysis..."
    npm run optimize:bundle 2>&1 | tee "$REPORT_DIR/bundle-analysis-$TIMESTAMP.log"
    
    success "Bundle analysis completed"
}

# ========================================
# CACHE WARMING
# ========================================

warm_cache() {
    log "Warming up caches..."
    
    # Cache warming endpoints
    local endpoints=(
        "/api/analytics?start=2025-01-01&end=2025-01-31"
        "/api/sales"
        "/api/audit"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Warming cache for: $endpoint"
        curl -s "$BASE_URL$endpoint" > /dev/null 2>&1 || warning "Failed to warm cache for $endpoint"
    done
    
    # Wait for cache to stabilize
    sleep 5
    
    success "Cache warming completed"
}

# ========================================
# SMOKE TESTS
# ========================================

run_smoke_tests() {
    log "Running smoke tests..."
    
    cd "$PROJECT_ROOT"
    
    # Quick smoke test with 10 concurrent users for 60 seconds
    npm run test:load:quick 2>&1 | tee "$REPORT_DIR/smoke-test-$TIMESTAMP.log"
    
    local smoke_exit_code=${PIPESTATUS[0]}
    
    if [ $smoke_exit_code -eq 0 ]; then
        success "Smoke tests passed"
    else
        error "Smoke tests failed!"
        warning "Check the smoke test log: $REPORT_DIR/smoke-test-$TIMESTAMP.log"
        return 1
    fi
}

# ========================================
# FULL LOAD TEST
# ========================================

run_load_test() {
    log "Running full load test..."
    log "Configuration:"
    log "  - Concurrent Users: $TARGET_CONCURRENT_USERS"
    log "  - Duration: $TEST_DURATION seconds (30 minutes)"
    log "  - SLO Targets: ${SLO_AVAILABILITY}% availability, p95≤${SLO_P95_RESPONSE_TIME}ms"
    
    cd "$PROJECT_ROOT"
    
    # Run the comprehensive load test
    local load_test_cmd="npm run test:load -- --concurrent=$TARGET_CONCURRENT_USERS --duration=$TEST_DURATION --baseUrl=$BASE_URL"
    
    log "Executing: $load_test_cmd"
    
    $load_test_cmd 2>&1 | tee "$REPORT_DIR/load-test-$TIMESTAMP.log"
    
    local load_test_exit_code=${PIPESTATUS[0]}
    
    if [ $load_test_exit_code -eq 0 ]; then
        success "Load test completed successfully - SLO targets achieved!"
        return 0
    else
        error "Load test failed - SLO targets not met!"
        return 1
    fi
}

# ========================================
# PERFORMANCE MONITORING
# ========================================

monitor_performance() {
    log "Starting performance monitoring..."
    
    cd "$PROJECT_ROOT"
    
    # Start SLO monitoring in background
    npm run monitor:slo &
    local monitor_pid=$!
    
    log "SLO monitoring started (PID: $monitor_pid)"
    
    # Return the PID so we can stop it later
    echo $monitor_pid
}

stop_monitoring() {
    local monitor_pid=$1
    
    if [ -n "$monitor_pid" ] && kill -0 $monitor_pid 2>/dev/null; then
        log "Stopping performance monitoring (PID: $monitor_pid)..."
        kill $monitor_pid
        success "Performance monitoring stopped"
    fi
}

# ========================================
# REPORT GENERATION
# ========================================

generate_report() {
    local test_status=$1
    local test_end_time=$(date +'%Y-%m-%d %H:%M:%S')
    
    log "Generating performance report..."
    
    local report_file="$REPORT_DIR/performance-report-$TIMESTAMP.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 1.5em; font-weight: bold; }
        .metric-label { font-size: 0.9em; color: #666; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
        .logs { background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Performance Test Report</h1>
        <p><strong>Test Date:</strong> $test_end_time</p>
        <p><strong>Environment:</strong> $ENVIRONMENT ($BASE_URL)</p>
        <p><strong>Status:</strong> <span class="$([ "$test_status" = "success" ] && echo "success" || echo "failure")">
            $([ "$test_status" = "success" ] && echo "✅ PASSED" || echo "❌ FAILED")
        </span></p>
    </div>

    <div class="section">
        <h2>🎯 SLO Targets</h2>
        <div class="metric">
            <div class="metric-value">$SLO_AVAILABILITY%</div>
            <div class="metric-label">Availability Target</div>
        </div>
        <div class="metric">
            <div class="metric-value">${SLO_P95_RESPONSE_TIME}ms</div>
            <div class="metric-label">P95 Response Time Target</div>
        </div>
        <div class="metric">
            <div class="metric-value">$TARGET_CONCURRENT_USERS</div>
            <div class="metric-label">Concurrent Users</div>
        </div>
        <div class="metric">
            <div class="metric-value">$((TEST_DURATION / 60))min</div>
            <div class="metric-label">Test Duration</div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Test Results</h2>
        <p>Detailed results are available in the log files:</p>
        <ul>
            <li><a href="./load-test-$TIMESTAMP.log">Load Test Results</a></li>
            <li><a href="./bundle-analysis-$TIMESTAMP.log">Bundle Analysis</a></li>
            <li><a href="./build-$TIMESTAMP.log">Build Log</a></li>
            $([ -f "$REPORT_DIR/smoke-test-$TIMESTAMP.log" ] && echo "<li><a href=\"./smoke-test-$TIMESTAMP.log\">Smoke Test Results</a></li>")
        </ul>
    </div>

    <div class="section">
        <h2>🔧 Optimizations Applied</h2>
        <table>
            <tr><th>Optimization</th><th>Status</th><th>Impact</th></tr>
            <tr><td>Edge Runtime</td><td>✅ Implemented</td><td>Global CDN distribution</td></tr>
            <tr><td>ISR Caching</td><td>✅ Implemented</td><td>5-minute static regeneration</td></tr>
            <tr><td>N+1 Query Elimination</td><td>✅ Implemented</td><td>JOIN optimization</td></tr>
            <tr><td>Multi-layer Caching</td><td>✅ Implemented</td><td>LRU + SWR strategies</td></tr>
            <tr><td>Bundle Optimization</td><td>✅ Implemented</td><td>Code splitting + tree shaking</td></tr>
            <tr><td>Database Indexes</td><td>✅ Implemented</td><td>Query performance boost</td></tr>
            <tr><td>Parallel Data Fetching</td><td>✅ Implemented</td><td>Reduced latency</td></tr>
            <tr><td>CDN Headers</td><td>✅ Implemented</td><td>Vercel edge caching</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>📋 Next Actions</h2>
        $(if [ "$test_status" = "success" ]; then
            echo "<p class=\"success\">🎉 Performance optimization is complete! All SLO targets have been achieved.</p>"
            echo "<ul>"
            echo "<li>✅ Monitor production performance metrics</li>"
            echo "<li>✅ Set up automated performance regression testing</li>"
            echo "<li>✅ Document performance best practices</li>"
            echo "<li>✅ Plan capacity scaling strategies</li>"
            echo "</ul>"
        else
            echo "<p class=\"failure\">⚠️ Performance targets not met. Additional optimization required.</p>"
            echo "<ul>"
            echo "<li>❌ Analyze performance bottlenecks in logs</li>"
            echo "<li>❌ Implement additional caching strategies</li>"
            echo "<li>❌ Optimize database queries further</li>"
            echo "<li>❌ Consider CDN and infrastructure scaling</li>"
            echo "</ul>"
        fi)
    </div>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; text-align: center;">
        <p>Generated by Performance Validation Script - Task #014</p>
        <p>Business Strategy Dashboard Performance Optimization</p>
    </footer>
</body>
</html>
EOF

    success "Performance report generated: $report_file"
    
    # Open report in browser if possible
    if command -v open &> /dev/null; then
        open "$report_file"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$report_file"
    fi
}

# ========================================
# MAIN EXECUTION FLOW
# ========================================

main() {
    log "🚀 Starting Performance Validation for Task #014"
    log "Target: 100CCU負荷・99.5%可用性・p95≤1500ms"
    log "=========================================="
    
    local test_start_time=$(date +'%Y-%m-%d %H:%M:%S')
    local overall_status="success"
    local monitor_pid=""
    
    # Execute test phases
    setup_environment || { overall_status="failure"; }
    
    if [ "$overall_status" = "success" ]; then
        preflight_checks || { overall_status="failure"; }
    fi
    
    if [ "$overall_status" = "success" ]; then
        analyze_bundle || { overall_status="failure"; }
    fi
    
    if [ "$overall_status" = "success" ]; then
        warm_cache
    fi
    
    if [ "$overall_status" = "success" ]; then
        run_smoke_tests || { overall_status="failure"; }
    fi
    
    if [ "$overall_status" = "success" ]; then
        monitor_pid=$(monitor_performance)
        run_load_test || { overall_status="failure"; }
        stop_monitoring "$monitor_pid"
    fi
    
    # Generate final report
    generate_report "$overall_status"
    
    # Final summary
    log "=========================================="
    if [ "$overall_status" = "success" ]; then
        success "🎉 Performance validation completed successfully!"
        success "All SLO targets achieved: ${SLO_AVAILABILITY}% availability, p95≤${SLO_P95_RESPONSE_TIME}ms"
        log "📊 Report: $REPORT_DIR/performance-report-$TIMESTAMP.html"
        exit 0
    else
        error "❌ Performance validation failed!"
        error "SLO targets not met. Additional optimization required."
        log "📊 Report: $REPORT_DIR/performance-report-$TIMESTAMP.html"
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"
