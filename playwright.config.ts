import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';
import path from 'path';

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

// Test result directories
const outputDir = './test-results';
const reportDir = './playwright-report';

export default defineConfig({
  // ==========================================
  // TEST DIRECTORY & PARALLEL EXECUTION
  // ==========================================
  
  testDir: './e2e',
  outputDir,
  
  /* Run tests in files in parallel for faster execution */
  fullyParallel: !CI, // Sequential in CI for stability
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: CI,
  
  // ==========================================
  // ENHANCED RETRY LOGIC & FAILURE HANDLING
  // ==========================================
  
  /* Enhanced retry logic with intelligent backoff */
  retries: CI ? 3 : 1, // More retries in CI for stability
  
  /* Optimize worker count for environment */
  workers: CI ? 2 : '50%', // Limit CI workers for stability, use 50% on local
  
  // ==========================================
  // COMPREHENSIVE REPORTING & ARTIFACT COLLECTION
  // ==========================================
  
  /* Multi-format reporting for CI integration */
  reporter: [
    // HTML report with enhanced features
    ['html', { 
      outputFolder: reportDir,
      open: CI ? 'never' : 'on-failure',
      host: 'localhost',
      port: 9323
    }],
    
    // JUnit XML for CI integration
    ['junit', { 
      outputFile: path.join(reportDir, 'junit-results.xml'),
      stripANSIControlSequences: true
    }],
    
    // GitHub Actions integration
    ...(CI ? [['github']] : []),
    
    // JSON report for programmatic access
    ['json', { 
      outputFile: path.join(reportDir, 'results.json') 
    }],
    
    // Enhanced line reporter with detailed info
    ['line', { printSteps: CI }],
    
    // Blob reporter for trace viewer integration
    ['blob', { 
      outputFile: path.join(reportDir, 'report.zip'),
      mode: CI ? 'merge' : 'open'
    }],

    // Custom reporter for enhanced failure analysis
    ['./e2e/utils/enhanced-reporter.ts']
  ],
  
  // ==========================================
  // GLOBAL TEST SETTINGS
  // ==========================================
  
  use: {
    /* Base URL for all tests */
    baseURL,
    
    /* Enhanced trace collection - ALWAYS enabled for comprehensive debugging */
    trace: 'on-first-retry', // Optimized: trace on first retry to save disk space
    
    /* Screenshot capture strategy - enhanced for debugging */
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    
    /* Video recording for failure analysis */
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },
    
    /* Action timeout (individual actions) */
    actionTimeout: 15000, // Increased for stability
    
    /* Navigation timeout */
    navigationTimeout: 45000, // Increased for complex pages
    
    /* Expect timeout */
    expect: {
      timeout: 10000
    },
    
    /* Ignore HTTPS errors in development */
    ignoreHTTPSErrors: !isProduction,
    
    /* Locale for testing */
    locale: 'ja-JP',
    
    /* Timezone for consistent testing */
    timezoneId: 'Asia/Tokyo',
    
    /* Viewport for consistent testing */
    viewport: { width: 1280, height: 720 },
    
    /* User agent string */
    userAgent: 'Business-Strategy-Dashboard-E2E-Tests/1.0 (Enhanced)',
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'X-Test-Run': 'playwright-e2e'
    },

    /* Enhanced context options for debugging */
    contextOptions: {
      // Collect browser console logs
      recordHar: CI ? undefined : { path: path.join(outputDir, 'network.har') },
    },

    /* Performance monitoring */
    launchOptions: {
      slowMo: CI ? 0 : 100, // Slow down actions in development for debugging
      logger: {
        isEnabled: (name, severity) => CI && severity >= 'info',
        log: (name, severity, message) => console.log(`[${name}] ${message}`)
      }
    }
  },
  
  // ==========================================
  // ENHANCED BROWSER PROJECT CONFIGURATION
  // ==========================================
  
  projects: [
    // =============
    // SETUP PROJECT
    // =============
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    
    // =================
    // TEARDOWN PROJECT
    // =================
    {
      name: 'teardown',
      testMatch: /.*\.teardown\.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    
    // =====================
    // SMOKE TESTS (Critical Path)
    // =====================
    {
      name: 'smoke',
      testMatch: /.*smoke.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Optimized for speed
        video: 'off',
        screenshot: 'only-on-failure'
      },
      dependencies: ['setup'],
      retries: 0, // No retries for smoke tests - they should be stable
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
            '--v=1',
            '--no-sandbox', // Required for CI
            '--disable-dev-shm-usage'
          ]
        }
      },
      dependencies: ['setup']
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true
          }
        }
      },
      dependencies: ['setup']
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // Webkit-specific optimizations
        launchOptions: {
          env: {
            WEBKIT_DISABLE_DMABUF_RENDERER: '1'
          }
        }
      },
      dependencies: ['setup']
    },
    
    // =====================
    // MOBILE TESTING
    // =====================
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific settings
        hasTouch: true,
        isMobile: true
      },
      dependencies: ['setup'],
      testIgnore: /.*desktop-only.*\.spec\.ts/ // Skip desktop-only tests
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        hasTouch: true,
        isMobile: true
      },
      dependencies: ['setup'],
      testIgnore: /.*desktop-only.*\.spec\.ts/
    },
    
    // =====================
    // TABLET TESTING
    // =====================
    {
      name: 'iPad',
      use: { 
        ...devices['iPad Pro'],
        hasTouch: true
      },
      dependencies: ['setup'],
      testIgnore: /.*mobile-only.*\.spec\.ts/
    },
    
    // ===========================
    // PERFORMANCE TESTING PROJECT
    // ===========================
    {
      name: 'performance',
      testMatch: /.*performance.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific configuration
        launchOptions: {
          args: [
            '--enable-performance-logging',
            '--enable-precise-memory-info',
            '--js-flags=--expose-gc',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding'
          ]
        }
      },
      dependencies: ['setup'],
      timeout: 90000 // Longer timeout for performance tests
    },
    
    // ==============================
    // ACCESSIBILITY TESTING PROJECT
    // ==============================
    {
      name: 'accessibility',
      testMatch: /.*accessibility.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Accessibility testing configuration
        launchOptions: {
          args: [
            '--force-prefers-reduced-motion',
            '--no-sandbox'
          ]
        }
      },
      dependencies: ['setup']
    },
    
    // ================================
    // VISUAL REGRESSION TESTING
    // ================================
    {
      name: 'visual',
      testMatch: /.*visual.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Consistent visual testing
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        // Disable animations for consistent screenshots
        contextOptions: {
          reducedMotion: 'reduce'
        }
      },
      dependencies: ['setup']
    },
    
    // ================================
    // REGRESSION TESTING
    // ================================
    {
      name: 'regression',
      testMatch: /.*regression.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome']
      },
      dependencies: ['setup'],
      retries: 2 // Additional retries for regression tests
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
      PLAYWRIGHT_TEST: 'true',
      // Test database URL for isolation
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  } : undefined,
  
  // ==========================================
  // TIMEOUT CONFIGURATION
  // ==========================================
  
  /* Global test timeout - 3 minutes per test */
  timeout: 180000,
  
  /* Global expect timeout with custom matchers */
  expect: {
    timeout: 15000,
    // Visual comparison threshold
    threshold: 0.2,
    // Animation handling for screenshots
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'rgb',
      animations: 'disabled',
      caret: 'hide'
    },
    // Performance thresholds
    toPass: {
      timeout: 30000,
      intervals: [1000, 2000, 5000] // Custom retry intervals
    }
  },
  
  // ==========================================
  // METADATA & ANNOTATIONS
  // ==========================================
  
  metadata: {
    testType: 'e2e-enhanced',
    project: 'business-strategy-dashboard',
    version: '1.0.0',
    environment: isProduction ? 'production' : 'development',
    ci: CI,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    os: process.platform
  },
  
  // ==========================================
  // GLOBAL SETUP & TEARDOWN
  // ==========================================
  
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/teardown/global-teardown.ts',

  // ==========================================
  // TEST OPTIONS
  // ==========================================

  /* Test discovery patterns */
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  /* Files to ignore */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**'
  ]
});
