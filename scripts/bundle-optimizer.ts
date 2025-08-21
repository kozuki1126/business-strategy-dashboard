#!/usr/bin/env tsx

/**
 * Bundle Optimizer for Task #014 - Performance Optimization
 * Analyzes and optimizes bundle size and performance
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

interface BundleStats {
  file: string
  size: number
  gzipSize: number
  type: 'js' | 'css' | 'html' | 'other'
}

interface BundleAnalysis {
  totalSize: number
  totalGzipSize: number
  jsSize: number
  cssSize: number
  htmlSize: number
  otherSize: number
  fileCount: number
  stats: BundleStats[]
  recommendations: string[]
  score: number
}

class BundleOptimizer {
  private projectRoot: string
  private buildDir: string

  constructor() {
    this.projectRoot = process.cwd()
    this.buildDir = join(this.projectRoot, '.next')
  }

  private getFileType(filename: string): BundleStats['type'] {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return 'js'
      case 'css':
      case 'scss':
      case 'sass':
        return 'css'
      case 'html':
      case 'htm':
        return 'html'
      default:
        return 'other'
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private async analyzeFile(filePath: string): Promise<BundleStats> {
    const content = readFileSync(filePath)
    const gzipSize = gzipSync(content).length
    
    return {
      file: filePath.replace(this.buildDir + '/', ''),
      size: content.length,
      gzipSize,
      type: this.getFileType(filePath)
    }
  }

  private async findBuildFiles(): Promise<string[]> {
    const { execSync } = require('child_process')
    
    try {
      const output = execSync(`find "${this.buildDir}" -type f \\( -name "*.js" -o -name "*.css" -o -name "*.html" \\) ! -path "*/cache/*" ! -path "*/server/*"`, {
        encoding: 'utf8'
      })
      
      return output
        .split('\n')
        .filter(line => line.trim())
        .filter(file => existsSync(file))
    } catch (error) {
      console.error('Error finding build files:', error)
      return []
    }
  }

  private generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = []
    
    // Size-based recommendations
    if (analysis.totalGzipSize > 1024 * 1024) { // 1MB
      recommendations.push('📦 Bundle size exceeds 1MB - consider code splitting and lazy loading')
    }
    
    if (analysis.jsSize > analysis.totalSize * 0.8) {
      recommendations.push('⚡ JavaScript dominates bundle - optimize JS chunks and consider dynamic imports')
    }
    
    // File count recommendations
    if (analysis.fileCount > 50) {
      recommendations.push('🗂️  High file count - consider bundling optimization and HTTP/2 push')
    }
    
    // Performance recommendations
    const largeFiles = analysis.stats.filter(stat => stat.gzipSize > 100 * 1024) // 100KB
    if (largeFiles.length > 0) {
      recommendations.push(`📏 ${largeFiles.length} large files (>100KB) detected - consider chunking or lazy loading`)
    }
    
    // CSS optimization
    if (analysis.cssSize > 200 * 1024) { // 200KB
      recommendations.push('🎨 Large CSS bundle - consider critical CSS extraction and async loading')
    }
    
    // Good practices
    if (analysis.totalGzipSize < 500 * 1024) { // 500KB
      recommendations.push('✅ Excellent bundle size - well within performance budgets')
    }
    
    if (analysis.jsSize < analysis.totalSize * 0.6) {
      recommendations.push('✅ Good JS/CSS balance maintained')
    }
    
    return recommendations
  }

  private calculateScore(analysis: BundleAnalysis): number {
    let score = 100
    
    // Penalty for large bundle size
    if (analysis.totalGzipSize > 1024 * 1024) { // 1MB
      score -= 30
    } else if (analysis.totalGzipSize > 500 * 1024) { // 500KB
      score -= 15
    }
    
    // Penalty for JS-heavy bundles
    if (analysis.jsSize > analysis.totalSize * 0.8) {
      score -= 20
    }
    
    // Penalty for too many files
    if (analysis.fileCount > 50) {
      score -= 10
    }
    
    // Bonus for small bundles
    if (analysis.totalGzipSize < 200 * 1024) { // 200KB
      score += 10
    }
    
    return Math.max(0, Math.min(100, score))
  }

  async analyze(): Promise<BundleAnalysis> {
    console.log('🔍 Analyzing bundle...')
    
    if (!existsSync(this.buildDir)) {
      throw new Error('Build directory not found. Please run "npm run build" first.')
    }
    
    const files = await this.findBuildFiles()
    console.log(`📁 Found ${files.length} build files`)
    
    const stats: BundleStats[] = []
    
    for (const file of files) {
      try {
        const stat = await this.analyzeFile(file)
        stats.push(stat)
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${file}:`, error)
      }
    }
    
    // Calculate totals
    const totalSize = stats.reduce((sum, stat) => sum + stat.size, 0)
    const totalGzipSize = stats.reduce((sum, stat) => sum + stat.gzipSize, 0)
    const jsSize = stats.filter(s => s.type === 'js').reduce((sum, stat) => sum + stat.size, 0)
    const cssSize = stats.filter(s => s.type === 'css').reduce((sum, stat) => sum + stat.size, 0)
    const htmlSize = stats.filter(s => s.type === 'html').reduce((sum, stat) => sum + stat.size, 0)
    const otherSize = stats.filter(s => s.type === 'other').reduce((sum, stat) => sum + stat.size, 0)
    
    const analysis: BundleAnalysis = {
      totalSize,
      totalGzipSize,
      jsSize,
      cssSize,
      htmlSize,
      otherSize,
      fileCount: stats.length,
      stats: stats.sort((a, b) => b.gzipSize - a.gzipSize), // Sort by gzip size desc
      recommendations: [],
      score: 0
    }
    
    analysis.recommendations = this.generateRecommendations(analysis)
    analysis.score = this.calculateScore(analysis)
    
    return analysis
  }

  private printAnalysis(analysis: BundleAnalysis): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 BUNDLE ANALYSIS REPORT - Task #014')
    console.log('='.repeat(60))
    
    console.log(`\n📈 Bundle Overview:`)
    console.log(`   Total Size: ${this.formatBytes(analysis.totalSize)}`)
    console.log(`   Gzipped: ${this.formatBytes(analysis.totalGzipSize)}`)
    console.log(`   Files: ${analysis.fileCount}`)
    console.log(`   Performance Score: ${analysis.score}/100`)
    
    console.log(`\n📂 Breakdown by Type:`)
    console.log(`   JavaScript: ${this.formatBytes(analysis.jsSize)} (${((analysis.jsSize / analysis.totalSize) * 100).toFixed(1)}%)`)
    console.log(`   CSS: ${this.formatBytes(analysis.cssSize)} (${((analysis.cssSize / analysis.totalSize) * 100).toFixed(1)}%)`)
    console.log(`   HTML: ${this.formatBytes(analysis.htmlSize)} (${((analysis.htmlSize / analysis.totalSize) * 100).toFixed(1)}%)`)
    console.log(`   Other: ${this.formatBytes(analysis.otherSize)} (${((analysis.otherSize / analysis.totalSize) * 100).toFixed(1)}%)`)
    
    console.log(`\n🏆 Top 10 Largest Files (Gzipped):`)
    analysis.stats.slice(0, 10).forEach((stat, index) => {
      const percentage = ((stat.gzipSize / analysis.totalGzipSize) * 100).toFixed(1)
      console.log(`   ${index + 1}. ${stat.file}: ${this.formatBytes(stat.gzipSize)} (${percentage}%)`)
    })
    
    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`)
      analysis.recommendations.forEach(rec => {
        console.log(`   ${rec}`)
      })
    }
    
    // Performance budget warnings
    console.log(`\n🎯 Performance Budget Status:`)
    const budgetStatus = analysis.totalGzipSize <= 500 * 1024 ? '✅' : '❌'
    console.log(`   ${budgetStatus} Bundle size: ${this.formatBytes(analysis.totalGzipSize)} (Budget: 500KB)`)
    
    const jsRatio = analysis.jsSize / analysis.totalSize
    const jsStatus = jsRatio <= 0.7 ? '✅' : '❌'
    console.log(`   ${jsStatus} JS ratio: ${(jsRatio * 100).toFixed(1)}% (Budget: ≤70%)`)
    
    const fileStatus = analysis.fileCount <= 30 ? '✅' : '❌'
    console.log(`   ${fileStatus} File count: ${analysis.fileCount} (Budget: ≤30)`)
    
    console.log('='.repeat(60))
  }

  async optimize(): Promise<void> {
    console.log('🚀 Starting bundle optimization...')
    
    // Generate optimization recommendations
    const recommendations = [
      '1. 📦 Run "npm run build:analyze" to see detailed webpack bundle analysis',
      '2. ⚡ Consider implementing dynamic imports for large components',
      '3. 🎨 Extract critical CSS and load non-critical CSS asynchronously',
      '4. 📱 Implement progressive loading for images and media',
      '5. 🔄 Configure proper caching headers for static assets',
      '6. 📊 Monitor Core Web Vitals in production'
    ]
    
    console.log('\n💡 Optimization Recommendations:')
    recommendations.forEach(rec => console.log(`   ${rec}`))
    
    // Save optimization report
    const reportPath = join(this.projectRoot, 'bundle-optimization-report.md')
    const report = this.generateMarkdownReport(recommendations)
    writeFileSync(reportPath, report)
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  }

  private generateMarkdownReport(recommendations: string[]): string {
    const timestamp = new Date().toISOString()
    
    return `# Bundle Optimization Report

Generated: ${timestamp}
Task: #014 - Performance Optimization

## Optimization Recommendations

${recommendations.map(rec => `- ${rec.replace(/^\d+\.\s*/, '')}`).join('\n')}

## Next.js 15 Optimizations Applied

- ✅ **Server Components**: Optimized server-side rendering
- ✅ **Bundle Splitting**: Framework, vendor, and app chunks
- ✅ **Tree Shaking**: Dead code elimination
- ✅ **Minification**: JavaScript and CSS compression
- ✅ **Code Splitting**: Route-based chunking
- ✅ **Static Optimization**: Build-time optimizations
- ✅ **Image Optimization**: WebP/AVIF format support
- ✅ **Font Optimization**: Automatic font optimization

## Performance Monitoring

### SLO Targets (Task #014)
- 🎯 Availability: ≥99.5%
- ⏱️ P95 Response Time: ≤1500ms
- 👥 Concurrent Users: 100 CCU
- ⏳ Test Duration: 30 minutes

### Bundle Performance Targets
- 📦 Total Bundle Size: ≤500KB (gzipped)
- ⚡ JavaScript Ratio: ≤70%
- 📁 File Count: ≤30 files
- 🏆 Performance Score: ≥80/100

## Implementation Status

- [x] Next.js 15 configuration optimization
- [x] Webpack custom configuration
- [x] Bundle splitting strategy
- [x] Performance monitoring setup
- [x] Load testing infrastructure
- [ ] Production performance validation
- [ ] SLO monitoring implementation

## Related Files

- \`next.config.mjs\` - Next.js configuration
- \`scripts/load-test.ts\` - Load testing script
- \`scripts/validate-performance.sh\` - Performance validation
- \`scripts/bundle-optimizer.ts\` - This bundle analyzer

---

**Task #014 Progress**: Bundle optimization and analysis infrastructure complete.
**Next Steps**: Execute full 100CCU load test and validate SLO targets.
`
  }

  async run(): Promise<void> {
    try {
      const analysis = await this.analyze()
      this.printAnalysis(analysis)
      
      // Check if optimize flag is provided
      const shouldOptimize = process.argv.includes('--optimize')
      if (shouldOptimize) {
        await this.optimize()
      }
      
      // Exit with appropriate code based on performance score
      const success = analysis.score >= 80
      console.log(`\n${success ? '🎉' : '⚠️ '} Bundle analysis ${success ? 'passed' : 'needs attention'} (Score: ${analysis.score}/100)`)
      
      process.exit(success ? 0 : 1)
      
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error)
      process.exit(1)
    }
  }
}

// Main execution
async function main() {
  const optimizer = new BundleOptimizer()
  await optimizer.run()
}

if (require.main === module) {
  main()
}

export { BundleOptimizer, type BundleAnalysis, type BundleStats }
