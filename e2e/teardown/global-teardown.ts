/**
 * Global Teardown for E2E Tests - Task #015
 * Cleanup test environment and generate final reports
 */

import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test environment cleanup...');

  try {
    // =================================
    // LOAD TEST METADATA
    // =================================
    
    const testResultsDir = path.join(process.cwd(), 'test-results');
    const metadataFile = path.join(testResultsDir, 'test-metadata.json');
    
    let testMetadata: any = {};
    try {
      const metadataContent = await fs.readFile(metadataFile, 'utf-8');
      testMetadata = JSON.parse(metadataContent);
    } catch (error) {
      console.warn('⚠️ Could not load test metadata');
    }
    
    // =================================
    // COLLECT TEST RESULTS SUMMARY
    // =================================
    
    console.log('📊 Generating test results summary...');
    
    const resultsFile = path.join(process.cwd(), 'playwright-report', 'results.json');
    let testResults: any = null;
    
    try {
      const resultsContent = await fs.readFile(resultsFile, 'utf-8');
      testResults = JSON.parse(resultsContent);
    } catch (error) {
      console.warn('⚠️ Could not load test results JSON');
    }
    
    // =================================
    // PERFORMANCE ANALYSIS
    // =================================
    
    const baselineFile = path.join(testResultsDir, 'performance-baseline.json');
    let performanceBaseline: any = null;
    
    try {
      const baselineContent = await fs.readFile(baselineFile, 'utf-8');
      performanceBaseline = JSON.parse(baselineContent);
    } catch (error) {
      console.warn('⚠️ Could not load performance baseline');
    }
    
    // =================================
    // TRACE ANALYSIS
    // =================================
    
    console.log('🔍 Analyzing test traces...');
    
    const tracesDir = path.join(testResultsDir, 'traces');
    let traceFiles: string[] = [];
    
    try {
      const files = await fs.readdir(tracesDir);
      traceFiles = files.filter(file => file.endsWith('.zip'));
    } catch (error) {
      console.warn('⚠️ Could not access traces directory');
    }
    
    // =================================
    // FAILURE ANALYSIS
    // =================================
    
    let failureAnalysis: any = {
      totalFailures: 0,
      failuresByCategory: {},
      criticalFailures: [],
      retryAnalysis: {}
    };
    
    if (testResults && testResults.suites) {
      const analyzeTestSuite = (suite: any) => {
        suite.tests?.forEach((test: any) => {
          test.results?.forEach((result: any) => {
            if (result.status === 'failed') {
              failureAnalysis.totalFailures++;
              
              // Categorize failures
              const error = result.error?.message || 'Unknown error';
              const category = categorizeError(error);
              failureAnalysis.failuresByCategory[category] = 
                (failureAnalysis.failuresByCategory[category] || 0) + 1;
              
              // Track critical failures
              if (test.title.includes('critical') || test.title.includes('authentication') || test.title.includes('performance')) {
                failureAnalysis.criticalFailures.push({
                  title: test.title,
                  error: error.substring(0, 200),
                  duration: result.duration
                });
              }
            }
            
            // Track retry analysis
            if (result.retry && result.retry > 0) {
              const retryKey = `retry_${result.retry}`;
              failureAnalysis.retryAnalysis[retryKey] = 
                (failureAnalysis.retryAnalysis[retryKey] || 0) + 1;
            }
          });
        });
        
        suite.suites?.forEach((subSuite: any) => analyzeTestSuite(subSuite));
      };
      
      testResults.suites.forEach((suite: any) => analyzeTestSuite(suite));
    }
    
    // =================================
    // GENERATE COMPREHENSIVE REPORT
    // =================================
    
    const finalReport = {
      summary: {
        testRunId: testMetadata.testRunId || `cleanup-${Date.now()}`,
        setupTime: testMetadata.setupTime,
        teardownTime: new Date().toISOString(),
        environment: testMetadata.environment || 'unknown',
        ci: testMetadata.ci || false,
        baseURL: testMetadata.baseURL
      },
      
      testExecution: {
        totalTests: testResults?.stats?.total || 0,
        passed: testResults?.stats?.passed || 0,
        failed: testResults?.stats?.failed || 0,
        skipped: testResults?.stats?.skipped || 0,
        duration: testResults?.stats?.duration || 0
      },
      
      performance: {
        baseline: performanceBaseline,
        sloCompliance: performanceBaseline ? {
          fcpUnder1500ms: performanceBaseline.firstContentfulPaint < 1500,
          domLoadUnder3000ms: performanceBaseline.domContentLoaded < 3000,
          overallGrade: calculatePerformanceGrade(performanceBaseline)
        } : null
      },
      
      failures: failureAnalysis,
      
      traces: {
        totalTraces: traceFiles.length,
        traceFiles: traceFiles.map(file => ({
          name: file,
          size: 'unknown', // Would need additional file stats
          timestamp: file.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)?.[0] || 'unknown'
        }))
      },
      
      recommendations: generateRecommendations(failureAnalysis, performanceBaseline),
      
      artifacts: {
        htmlReport: 'playwright-report/index.html',
        jsonResults: 'playwright-report/results.json',
        junitResults: 'playwright-report/results.xml',
        traces: 'test-results/traces/',
        screenshots: 'test-results/',
        videos: 'test-results/'
      }
    };
    
    // =================================
    // SAVE FINAL REPORT
    // =================================
    
    const finalReportFile = path.join(process.cwd(), 'playwright-report', 'final-report.json');
    await fs.writeFile(finalReportFile, JSON.stringify(finalReport, null, 2));
    
    // =================================
    // CONSOLE SUMMARY
    // =================================
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 E2E TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Test Run ID: ${finalReport.summary.testRunId}`);
    console.log(`🌐 Environment: ${finalReport.summary.environment}`);
    console.log(`⏱️  Total Duration: ${(finalReport.testExecution.duration / 1000).toFixed(2)}s`);
    console.log(`✅ Passed: ${finalReport.testExecution.passed}`);
    console.log(`❌ Failed: ${finalReport.testExecution.failed}`);
    console.log(`⏭️  Skipped: ${finalReport.testExecution.skipped}`);
    
    if (performanceBaseline) {
      console.log(`📈 Performance Grade: ${finalReport.performance.sloCompliance?.overallGrade || 'N/A'}`);
      console.log(`⚡ First Contentful Paint: ${performanceBaseline.firstContentfulPaint.toFixed(2)}ms`);
    }
    
    if (failureAnalysis.totalFailures > 0) {
      console.log(`🔴 Critical Failures: ${failureAnalysis.criticalFailures.length}`);
      console.log(`🔄 Retry Success Rate: ${calculateRetrySuccessRate(failureAnalysis)}%`);
    }
    
    console.log(`🗂️  Traces Collected: ${traceFiles.length}`);
    console.log(`📊 Final Report: ${finalReportFile}`);
    console.log('='.repeat(60));
    
    // =================================
    // CLEANUP TEMPORARY FILES
    // =================================
    
    console.log('🗑️ Cleaning up temporary files...');
    
    // Clean up auth state file if exists
    const authStateFile = path.join(testResultsDir, 'auth-state.json');
    try {
      await fs.unlink(authStateFile);
    } catch {
      // Ignore if file doesn't exist
    }
    
    // Clean up old trace files (keep only last 10)
    if (traceFiles.length > 10) {
      const sortedTraces = traceFiles.sort();
      const tracesToDelete = sortedTraces.slice(0, -10);
      
      for (const traceFile of tracesToDelete) {
        try {
          await fs.unlink(path.join(tracesDir, traceFile));
        } catch (error) {
          console.warn(`⚠️ Could not delete trace file: ${traceFile}`);
        }
      }
      
      console.log(`🗑️ Cleaned up ${tracesToDelete.length} old trace files`);
    }
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

// =================================
// HELPER FUNCTIONS
// =================================

function categorizeError(errorMessage: string): string {
  const error = errorMessage.toLowerCase();
  
  if (error.includes('timeout') || error.includes('waiting')) return 'timeout';
  if (error.includes('network') || error.includes('fetch')) return 'network';
  if (error.includes('selector') || error.includes('element')) return 'element';
  if (error.includes('navigation') || error.includes('page')) return 'navigation';
  if (error.includes('assertion') || error.includes('expect')) return 'assertion';
  if (error.includes('authentication') || error.includes('auth')) return 'authentication';
  if (error.includes('performance') || error.includes('slow')) return 'performance';
  
  return 'unknown';
}

function calculatePerformanceGrade(baseline: any): string {
  if (!baseline) return 'N/A';
  
  const fcp = baseline.firstContentfulPaint;
  const domLoad = baseline.domContentLoaded;
  
  if (fcp < 1000 && domLoad < 2000) return 'A+';
  if (fcp < 1500 && domLoad < 3000) return 'A';
  if (fcp < 2000 && domLoad < 4000) return 'B';
  if (fcp < 3000 && domLoad < 6000) return 'C';
  
  return 'D';
}

function calculateRetrySuccessRate(analysis: any): number {
  const totalRetries = Object.values(analysis.retryAnalysis).reduce((sum: number, count: any) => sum + count, 0);
  const totalFailures = analysis.totalFailures;
  
  if (totalFailures === 0) return 100;
  if (totalRetries === 0) return 0;
  
  return Math.round(((totalRetries / (totalRetries + totalFailures)) * 100));
}

function generateRecommendations(failures: any, baseline: any): string[] {
  const recommendations: string[] = [];
  
  // Performance recommendations
  if (baseline) {
    if (baseline.firstContentfulPaint > 1500) {
      recommendations.push('Consider optimizing First Contentful Paint (target: <1500ms)');
    }
    if (baseline.domContentLoaded > 3000) {
      recommendations.push('Consider optimizing DOM load time (target: <3000ms)');
    }
  }
  
  // Failure recommendations
  if (failures.failuresByCategory.timeout > 0) {
    recommendations.push('Multiple timeout failures detected - consider increasing timeouts or optimizing page load speed');
  }
  
  if (failures.failuresByCategory.element > 0) {
    recommendations.push('Element selection failures detected - review selector stability and page loading states');
  }
  
  if (failures.criticalFailures.length > 0) {
    recommendations.push('Critical test failures detected - prioritize fixing authentication, performance, and core functionality tests');
  }
  
  if (Object.keys(failures.retryAnalysis).length > 0) {
    recommendations.push('Tests are requiring retries - investigate flaky test patterns and improve test stability');
  }
  
  return recommendations;
}

export default globalTeardown;
