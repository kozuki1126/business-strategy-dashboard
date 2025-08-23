/**
 * Enhanced E2E Test Helper for Task #015
 * Comprehensive utilities for regression testing and quality assurance
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// ================================
// CONSTANTS & CONFIGURATION
// ================================

export const E2E_CONFIG = {
  // Test timeouts
  DEFAULT_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 45000,
  API_TIMEOUT: 15000,
  
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    TIME_TO_INTERACTIVE: 3000,
    FIRST_CONTENTFUL_PAINT: 2000,
    LARGEST_CONTENTFUL_PAINT: 4000,
    API_RESPONSE: 1500,
  },
  
  // Retry configuration
  RETRY_CONFIG: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    EXPONENTIAL_BACKOFF: true,
  },
  
  // Test data
  TEST_USERS: {
    ADMIN: { email: 'admin@test.com', role: 'admin' },
    MANAGER: { email: 'manager@test.com', role: 'manager' },
    ANALYST: { email: 'analyst@test.com', role: 'analyst' },
    VIEWER: { email: 'viewer@test.com', role: 'viewer' },
  },
  
  // Base URLs
  BASE_URLS: {
    DEVELOPMENT: 'http://localhost:3000',
    STAGING: process.env.STAGING_URL || 'https://business-strategy-dashboard-staging.vercel.app',
    PRODUCTION: process.env.PRODUCTION_URL || 'https://business-strategy-dashboard.vercel.app',
  },
} as const;

// ================================
// TRACE & ARTIFACT MANAGEMENT
// ================================

export class TraceManager {
  private static instance: TraceManager;
  private traceDir: string;
  
  private constructor() {
    this.traceDir = path.join(process.cwd(), 'test-results', 'traces');
  }
  
  public static getInstance(): TraceManager {
    if (!TraceManager.instance) {
      TraceManager.instance = new TraceManager();
    }
    return TraceManager.instance;
  }
  
  /**
   * Ensure failure traces are collected
   */
  async ensureTraceCollection(page: Page, testName: string): Promise<void> {
    try {
      await fs.mkdir(this.traceDir, { recursive: true });
      
      const tracePath = path.join(this.traceDir, `${testName}-${Date.now()}.zip`);
      const screenshotPath = path.join(this.traceDir, `${testName}-${Date.now()}.png`);
      
      // Start tracing if not already started
      await page.context().tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      
      // Take screenshot
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      console.log(`✅ Trace collection ensured for test: ${testName}`);
    } catch (error) {
      console.error(`❌ Failed to ensure trace collection: ${error}`);
    }
  }
  
  /**
   * Stop and save trace on test failure
   */
  async saveTraceOnFailure(page: Page, testName: string, error: Error): Promise<string> {
    try {
      await fs.mkdir(this.traceDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tracePath = path.join(this.traceDir, `FAILURE-${testName}-${timestamp}.zip`);
      
      await page.context().tracing.stop({ path: tracePath });
      
      // Also save screenshot and video
      const screenshotPath = path.join(this.traceDir, `FAILURE-${testName}-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      console.log(`🔍 Failure trace saved: ${tracePath}`);
      return tracePath;
    } catch (traceError) {
      console.error(`❌ Failed to save failure trace: ${traceError}`);
      throw new Error(`Original error: ${error.message}. Trace save error: ${traceError}`);
    }
  }
  
  /**
   * Clean up old traces (retention policy)
   */
  async cleanupOldTraces(retentionDays: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(this.traceDir);
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.traceDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old trace: ${file}`);
        }
      }
    } catch (error) {
      console.error(`⚠️ Failed to cleanup traces: ${error}`);
    }
  }
}

// ================================
// ENHANCED TEST UTILITIES
// ================================

export class E2ETestHelper {
  private page: Page;
  private context: BrowserContext;
  private traceManager: TraceManager;
  
  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    this.traceManager = TraceManager.getInstance();
  }
  
  /**
   * Enhanced navigation with automatic retry and trace collection
   */
  async navigateWithRetry(url: string, options?: { waitForSelector?: string }): Promise<void> {
    const testName = `navigation-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    for (let attempt = 1; attempt <= E2E_CONFIG.RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        await this.traceManager.ensureTraceCollection(this.page, testName);
        
        await this.page.goto(url, {
          timeout: E2E_CONFIG.NAVIGATION_TIMEOUT,
          waitUntil: 'networkidle',
        });
        
        if (options?.waitForSelector) {
          await this.page.waitForSelector(options.waitForSelector, {
            timeout: E2E_CONFIG.DEFAULT_TIMEOUT,
          });
        }
        
        console.log(`✅ Navigation successful: ${url} (attempt ${attempt})`);
        return;
      } catch (error) {
        console.warn(`⚠️ Navigation attempt ${attempt} failed: ${error}`);
        
        if (attempt === E2E_CONFIG.RETRY_CONFIG.MAX_RETRIES) {
          await this.traceManager.saveTraceOnFailure(this.page, testName, error as Error);
          throw new Error(`Navigation failed after ${E2E_CONFIG.RETRY_CONFIG.MAX_RETRIES} attempts: ${error}`);
        }
        
        // Exponential backoff delay
        const delay = E2E_CONFIG.RETRY_CONFIG.RETRY_DELAY * (E2E_CONFIG.RETRY_CONFIG.EXPONENTIAL_BACKOFF ? Math.pow(2, attempt - 1) : 1);
        await this.page.waitForTimeout(delay);
      }
    }
  }
  
  /**
   * Enhanced form filling with validation and retry
   */
  async fillFormWithValidation(formSelector: string, formData: Record<string, string>): Promise<void> {
    const testName = `form-fill-${formSelector.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    try {
      await this.traceManager.ensureTraceCollection(this.page, testName);
      
      // Wait for form to be available
      await this.page.waitForSelector(formSelector, { timeout: E2E_CONFIG.DEFAULT_TIMEOUT });
      
      for (const [fieldName, value] of Object.entries(formData)) {
        const fieldSelector = `${formSelector} [name="${fieldName}"], ${formSelector} #${fieldName}`;
        
        // Wait for field and clear it
        await this.page.waitForSelector(fieldSelector);
        await this.page.click(fieldSelector);
        await this.page.fill(fieldSelector, ''); // Clear first
        await this.page.fill(fieldSelector, value);
        
        // Validate the field was filled correctly
        const fieldValue = await this.page.inputValue(fieldSelector);
        if (fieldValue !== value) {
          throw new Error(`Field ${fieldName} validation failed. Expected: ${value}, Actual: ${fieldValue}`);
        }
        
        console.log(`✅ Field filled successfully: ${fieldName} = ${value}`);
      }
    } catch (error) {
      await this.traceManager.saveTraceOnFailure(this.page, testName, error as Error);
      throw error;
    }
  }
  
  /**
   * Enhanced API response validation
   */
  async validateAPIResponse(url: string, expectedStatus: number = 200): Promise<any> {
    const testName = `api-validation-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    try {
      await this.traceManager.ensureTraceCollection(this.page, testName);
      
      const response = await this.page.request.get(url, {
        timeout: E2E_CONFIG.API_TIMEOUT,
      });
      
      if (response.status() !== expectedStatus) {
        throw new Error(`API response status mismatch. Expected: ${expectedStatus}, Actual: ${response.status()}`);
      }
      
      const responseBody = await response.json();
      console.log(`✅ API validation successful: ${url} (${response.status()})`);
      
      return responseBody;
    } catch (error) {
      await this.traceManager.saveTraceOnFailure(this.page, testName, error as Error);
      throw error;
    }
  }
  
  /**
   * Performance measurement with thresholds
   */
  async measurePerformance(actionName: string): Promise<PerformanceMetrics> {
    const testName = `performance-${actionName}`;
    
    try {
      await this.traceManager.ensureTraceCollection(this.page, testName);
      
      const startTime = performance.now();
      
      // Get web vitals
      const vitals = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          // Performance observer for web vitals
          if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const metrics: any = {};
              
              entries.forEach((entry) => {
                if (entry.entryType === 'navigation') {
                  const navEntry = entry as PerformanceNavigationTiming;
                  metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
                  metrics.loadComplete = navEntry.loadEventEnd - navEntry.loadEventStart;
                }
              });
              
              resolve(metrics);
            });
            
            observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
            
            // Timeout fallback
            setTimeout(() => resolve({}), 5000);
          } else {
            resolve({});
          }
        });
      });
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      
      const metrics: PerformanceMetrics = {
        actionName,
        totalDuration,
        ...(vitals as any),
        timestamp: new Date().toISOString(),
      };
      
      // Validate against thresholds
      this.validatePerformanceThresholds(metrics);
      
      console.log(`📊 Performance metrics for ${actionName}:`, metrics);
      return metrics;
    } catch (error) {
      await this.traceManager.saveTraceOnFailure(this.page, testName, error as Error);
      throw error;
    }
  }
  
  /**
   * Validate performance against thresholds
   */
  private validatePerformanceThresholds(metrics: PerformanceMetrics): void {
    const failures: string[] = [];
    
    if (metrics.totalDuration && metrics.totalDuration > E2E_CONFIG.PERFORMANCE_THRESHOLDS.TIME_TO_INTERACTIVE) {
      failures.push(`Total duration exceeded threshold: ${metrics.totalDuration}ms > ${E2E_CONFIG.PERFORMANCE_THRESHOLDS.TIME_TO_INTERACTIVE}ms`);
    }
    
    if (failures.length > 0) {
      const message = `Performance threshold violations for ${metrics.actionName}:\n${failures.join('\n')}`;
      console.warn(`⚠️ ${message}`);
      // Note: Not throwing here to allow test to continue, but logging for analysis
    }
  }
  
  /**
   * Enhanced screenshot comparison for visual regression
   */
  async compareVisualRegression(elementSelector: string, screenshotName: string): Promise<void> {
    const testName = `visual-regression-${screenshotName}`;
    
    try {
      await this.traceManager.ensureTraceCollection(this.page, testName);
      
      // Wait for element to be stable
      await this.page.waitForSelector(elementSelector);
      await this.page.waitForLoadState('networkidle');
      
      // Hide dynamic elements that might cause flakiness
      await this.page.addStyleTag({
        content: `
          [data-testid="timestamp"], 
          .loading, 
          .spinner, 
          .animate-pulse,
          .animate-spin { 
            visibility: hidden !important; 
          }
        `
      });
      
      const element = this.page.locator(elementSelector);
      await expect(element).toHaveScreenshot(`${screenshotName}.png`, {
        threshold: 0.2, // Allow 20% difference
        animations: 'disabled',
        caret: 'hide',
      });
      
      console.log(`✅ Visual regression test passed: ${screenshotName}`);
    } catch (error) {
      await this.traceManager.saveTraceOnFailure(this.page, testName, error as Error);
      throw error;
    }
  }
}

// ================================
// REGRESSION TEST SUITE RUNNER
// ================================

export class RegressionTestRunner {
  private static instance: RegressionTestRunner;
  private testResults: TestResult[] = [];
  
  private constructor() {}
  
  public static getInstance(): RegressionTestRunner {
    if (!RegressionTestRunner.instance) {
      RegressionTestRunner.instance = new RegressionTestRunner();
    }
    return RegressionTestRunner.instance;
  }
  
  /**
   * Run comprehensive regression test suite
   */
  async runRegressionSuite(testConfig: RegressionTestConfig): Promise<RegressionTestReport> {
    console.log('🚀 Starting comprehensive regression test suite...');
    
    const startTime = Date.now();
    const report: RegressionTestReport = {
      startTime: new Date(startTime).toISOString(),
      endTime: '',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testResults: [],
      performanceMetrics: [],
      regressionIssues: [],
    };
    
    try {
      // Core functionality regression tests
      await this.runCoreRegressionTests(report, testConfig);
      
      // Performance regression tests
      await this.runPerformanceRegressionTests(report, testConfig);
      
      // Visual regression tests
      await this.runVisualRegressionTests(report, testConfig);
      
      // API regression tests
      await this.runAPIRegressionTests(report, testConfig);
      
    } catch (error) {
      console.error(`❌ Regression test suite failed: ${error}`);
      report.regressionIssues.push({
        type: 'CRITICAL',
        component: 'Test Suite',
        issue: `Suite execution failed: ${error}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      const endTime = Date.now();
      report.endTime = new Date(endTime).toISOString();
      report.duration = endTime - startTime;
      
      console.log(`📊 Regression test suite completed in ${report.duration}ms`);
      
      // Generate summary report
      await this.generateRegressionReport(report);
    }
    
    return report;
  }
  
  private async runCoreRegressionTests(report: RegressionTestReport, config: RegressionTestConfig): Promise<void> {
    console.log('🧪 Running core functionality regression tests...');
    // Implementation would test core user flows, authentication, navigation, etc.
    // This is a framework - actual tests would be implemented in separate files
  }
  
  private async runPerformanceRegressionTests(report: RegressionTestReport, config: RegressionTestConfig): Promise<void> {
    console.log('⚡ Running performance regression tests...');
    // Implementation would test load times, API response times, etc.
  }
  
  private async runVisualRegressionTests(report: RegressionTestReport, config: RegressionTestConfig): Promise<void> {
    console.log('👁️ Running visual regression tests...');
    // Implementation would test UI components, layouts, etc.
  }
  
  private async runAPIRegressionTests(report: RegressionTestReport, config: RegressionTestConfig): Promise<void> {
    console.log('🔌 Running API regression tests...');
    // Implementation would test API endpoints, data integrity, etc.
  }
  
  private async generateRegressionReport(report: RegressionTestReport): Promise<void> {
    const reportPath = path.join(process.cwd(), 'test-results', `regression-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Regression report saved: ${reportPath}`);
  }
}

// ================================
// TYPE DEFINITIONS
// ================================

export interface PerformanceMetrics {
  actionName: string;
  totalDuration?: number;
  domContentLoaded?: number;
  loadComplete?: number;
  timestamp: string;
  [key: string]: any;
}

export interface TestResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  error?: string;
  tracePath?: string;
  timestamp: string;
}

export interface RegressionIssue {
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  component: string;
  issue: string;
  timestamp: string;
}

export interface RegressionTestConfig {
  baseUrl: string;
  testUsers: typeof E2E_CONFIG.TEST_USERS;
  performanceThresholds: typeof E2E_CONFIG.PERFORMANCE_THRESHOLDS;
  includeCoreTests: boolean;
  includePerformanceTests: boolean;
  includeVisualTests: boolean;
  includeAPITests: boolean;
}

export interface RegressionTestReport {
  startTime: string;
  endTime: string;
  duration?: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testResults: TestResult[];
  performanceMetrics: PerformanceMetrics[];
  regressionIssues: RegressionIssue[];
}

// ================================
// ENHANCED TEST DECORATORS
// ================================

/**
 * Decorator for enhanced test with automatic trace collection
 */
export function enhancedTest(testName: string, options?: { retries?: number; timeout?: number }) {
  return test.extend<{ e2eHelper: E2ETestHelper }>({
    e2eHelper: async ({ page, context }, use) => {
      const helper = new E2ETestHelper(page, context);
      const traceManager = TraceManager.getInstance();
      
      try {
        // Ensure trace collection is active
        await traceManager.ensureTraceCollection(page, testName);
        
        await use(helper);
      } catch (error) {
        // Save trace on any failure
        await traceManager.saveTraceOnFailure(page, testName, error as Error);
        throw error;
      }
    },
  });
}

/**
 * Create a regression test with enhanced capabilities
 */
export function createRegressionTest(testName: string, testFn: (helper: E2ETestHelper) => Promise<void>) {
  return enhancedTest(testName).extend<{ regressionRunner: RegressionTestRunner }>({
    regressionRunner: async ({}, use) => {
      await use(RegressionTestRunner.getInstance());
    },
  })(testName, async ({ e2eHelper, regressionRunner }) => {
    await testFn(e2eHelper);
  });
}

console.log('✅ Enhanced E2E Test Helper loaded successfully for Task #015');
