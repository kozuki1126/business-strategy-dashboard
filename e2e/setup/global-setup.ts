/**
 * Global Setup for E2E Tests - Task #015
 * Prepares test environment and authentication
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  // =================================
  // ENVIRONMENT VALIDATION
  // =================================
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  const isProduction = baseURL.includes('vercel.app') || baseURL.includes('production');
  
  console.log(`🌐 Base URL: ${baseURL}`);
  console.log(`🏭 Environment: ${isProduction ? 'Production' : 'Development'}`);
  
  // =================================
  // CREATE TEST DIRECTORIES
  // =================================
  
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const playwrightReportDir = path.join(process.cwd(), 'playwright-report');
  const tracesDir = path.join(testResultsDir, 'traces');
  
  await fs.mkdir(testResultsDir, { recursive: true });
  await fs.mkdir(playwrightReportDir, { recursive: true });
  await fs.mkdir(tracesDir, { recursive: true });
  
  console.log('📁 Created test directories');
  
  // =================================
  // BROWSER SETUP & HEALTH CHECK
  // =================================
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🔍 Performing health check...');
    
    // Health check with timeout
    const response = await page.goto(baseURL, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    if (!response || !response.ok()) {
      throw new Error(`Health check failed: ${response?.status()} ${response?.statusText()}`);
    }
    
    console.log('✅ Health check passed');
    
    // =================================
    // AUTHENTICATION SETUP
    // =================================
    
    if (!isProduction) {
      console.log('🔐 Setting up test authentication...');
      
      // Check if auth page is accessible
      await page.goto(`${baseURL}/auth`);
      await page.waitForSelector('form', { timeout: 10000 });
      
      // Store auth state for tests
      const authStateFile = path.join(testResultsDir, 'auth-state.json');
      
      // Create mock auth state for development
      const authState = {
        cookies: [],
        origins: [{
          origin: baseURL,
          localStorage: [{
            name: 'test-user',
            value: JSON.stringify({
              id: 'test-user-id',
              email: 'test@example.com',
              role: 'admin'
            })
          }]
        }]
      };
      
      await fs.writeFile(authStateFile, JSON.stringify(authState, null, 2));
      console.log('✅ Authentication state prepared');
    }
    
    // =================================
    // PERFORMANCE BASELINE
    // =================================
    
    console.log('📊 Collecting performance baseline...');
    
    const performanceMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        loadComplete: perfData.loadEventEnd - perfData.navigationStart,
        firstPaint: paintEntries.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        timestamp: new Date().toISOString()
      };
    });
    
    const baselineFile = path.join(testResultsDir, 'performance-baseline.json');
    await fs.writeFile(baselineFile, JSON.stringify(performanceMetrics, null, 2));
    
    console.log(`📈 Performance baseline: FCP ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);
    
    // =================================
    // TEST METADATA
    // =================================
    
    const testMetadata = {
      setupTime: new Date().toISOString(),
      baseURL,
      environment: isProduction ? 'production' : 'development',
      ci: !!process.env.CI,
      nodeVersion: process.version,
      playwrightVersion: require('@playwright/test/package.json').version,
      testRunId: `test-${Date.now()}`,
      performanceBaseline: performanceMetrics
    };
    
    const metadataFile = path.join(testResultsDir, 'test-metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify(testMetadata, null, 2));
    
    console.log('📋 Test metadata saved');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('✅ Global setup completed successfully');
}

export default globalSetup;
