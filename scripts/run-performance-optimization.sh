#!/bin/bash
# Performance Optimization Execution Script
# Task #014: 性能・p95最適化実装

set -e

echo "🚀 Starting Performance Optimization for Task #014"
echo "Target: 100CCU負荷・99.5%可用性・p95≤1500ms"
echo "================================================"

# Check if we have the required environment
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from project root."
    exit 1
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run performance optimization script
echo "🔧 Running performance optimization..."
if command -v tsx >/dev/null 2>&1; then
    tsx scripts/performance-optimization-014.ts
else
    echo "⚠️  tsx not found, installing..."
    npm install -g tsx
    tsx scripts/performance-optimization-014.ts
fi

# Run bundle analysis
echo "📊 Analyzing bundle size..."
npm run build:analyze || echo "⚠️  Bundle analysis failed, continuing..."

# Run load tests
echo "🧪 Running load tests..."
npm run test:load:quick || echo "⚠️  Load test failed, continuing..."

# Check SLO compliance
echo "📈 Checking SLO compliance..."
npm run perf:slo || echo "⚠️  SLO check failed, check the implementation"

echo "✅ Performance optimization process completed!"
echo "📝 Check docs/performance-optimization-report.md for detailed results"
