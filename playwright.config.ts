import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright Configuration for Task #015
 * E2E Test Comprehensive Implementation with CI Integration
 * @see https://playwright.dev/docs/test-configuration
 */

// Environment configuration
const CI = !!process.env.CI;
const isProduction = process.env.NODE_ENV === 'production';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 
                (isProduction ? 'https://business-strategy-dashboard.vercel.app' : 'http://localhost:3000');

export default defineConfig({
  // ==========================================
  // TEST DIRECTORY & PARALLEL EXECUTION
  // ==========================================
  
  testDir: './e2e',
  outputDir: './test-results',
  
  /* Run tests in files in parallel for faster execution */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: CI,
  
  // ==========================================
  // RETRY LOGIC & FAILURE HANDLING
  // ==========================================
  
  /* Enhanced retry logic with intelligent backoff */
  retries: CI ? 3 : 1, // More retries in CI for stability
  
  /* Optimize worker count for environment */
  workers: CI ? 2 : undefined, // Limit CI workers for stability
  
  // ==========================================
  // COMPREHENSIVE REPORTING
  // ==========================================
  
  /* Multi-format reporting for CI integration */
  reporter: [
    // HTML report for detailed analysis
    ['html', { 
      outputFolder: 'playwright-report',
      open: CI ? 'never' : 'on-failure'
    }],
    
    // JUnit XML for CI integration
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    
    // GitHub Actions integration
    ...(CI ? [['github']] : [['list', { printSteps: true }]]),
    
    // JSON report for programmatic access
    ['json', { outputFile: 'playwright-report/results.json' }],
    
    // Line reporter for console output
    ['line']
  ],
  
  // ==========================================
  // GLOBAL TEST SETTINGS
  // ==========================================
  
  use: {
    /* Base URL for all tests */
    baseURL,
    
    /* Enhanced trace collection - ALWAYS enabled for debugging */
    trace: 'on', // Changed from 'retain-on-failure' to 'on' for comprehensive debugging
    
    /* Screenshot capture strategy */
    screenshot: 'only-on-failure',
    
    /* Video recording for failure analysis */
    video: 'retain-on-failure',
    
    /* Action timeout (individual actions) */
    actionTimeout: 10000,
    
    /* Navigation timeout */
    navigationTimeout: 30000,
    
    /* Ignore HTTPS errors in development */
    ignoreHTTPSErrors: !isProduction,
    
    /* Locale for testing */
    locale: 'ja-JP',
    
    /* Timezone for consistent testing */
    timezoneId: 'Asia/Tokyo',
    
    /* Viewport for consistent testing */
    viewport: { width: 1280, height: 720 },
    
    /* User agent string */
    userAgent: 'Business-Strategy-Dashboard-E2E-Tests/1.0',
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8'
    }
  },
  
  // ==========================================
  // BROWSER PROJECT CONFIGURATION
  // ==========================================
  
  projects: [
    // =============
    // SETUP PROJECT
    // =============
    {
      name: 'setup',
      testMatch: '**/setup/*.ts',
      teardown: 'teardown'
    },
    
    // =================
    // TEARDOWN PROJECT
    // =================
    {
      name: 'teardown',
      testMatch: '**/teardown/*.ts'
    },
    
    // =====================
    // DESKTOP BROWSERS
    // =====================
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable performance monitoring
        launchOptions: {
          args: [
            '--enable-performance-logging',
            '--enable-logging',
            '--v=1'
          ]
        }
      },
      dependencies: ['setup']
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup']
    },
    
    // =====================
    // MOBILE TESTING
    // =====================
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup']
    },
    
    // =====================
    // TABLET TESTING
    // =====================
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup']
    },
    
    // ===========================
    // PERFORMANCE TESTING PROJECT
    // ===========================
    {
      name: 'performance',
      testMatch: '**/performance/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific configuration
        launchOptions: {
          args: [
            '--enable-performance-logging',
            '--enable-precise-memory-info',
            '--js-flags=--expose-gc'
          ]
        }
      },
      dependencies: ['setup']
    },
    
    // ==============================
    // ACCESSIBILITY TESTING PROJECT
    // ==============================
    {
      name: 'accessibility',
      testMatch: '**/accessibility/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Accessibility testing configuration
        launchOptions: {
          args: ['--force-prefers-reduced-motion']
        }
      },
      dependencies: ['setup']
    },
    
    // ================================
    // VISUAL REGRESSION TESTING
    // ================================
    {
      name: 'visual',
      testMatch: '**/visual/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Consistent visual testing
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1
      },
      dependencies: ['setup']
    }
  ],
  
  // ==========================================
  // DEVELOPMENT SERVER CONFIGURATION
  // ==========================================
  
  webServer: !isProduction ? {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 120000, // 2 minutes for dev server startup
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
      PLAYWRIGHT_TEST: 'true'
    }
  } : undefined,
  
  // ==========================================
  // TIMEOUT CONFIGURATION
  // ==========================================
  
  /* Global test timeout - 2 minutes per test */
  timeout: 120000,
  
  /* Global expect timeout */
  expect: {
    timeout: 10000,
    // Visual comparison threshold
    threshold: 0.2,
    // Animation handling
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'rgb',
      animations: 'disabled'
    }
  },
  
  // ==========================================
  // METADATA & ANNOTATIONS
  // ==========================================
  
  metadata: {
    testType: 'e2e',
    project: 'business-strategy-dashboard',
    version: '1.0.0',
    environment: isProduction ? 'production' : 'development',
    ci: CI,
    timestamp: new Date().toISOString()
  },
  
  // ==========================================
  // GLOBAL SETUP & TEARDOWN
  // ==========================================
  
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/teardown/global-teardown.ts'
});
