/**
 * Enhanced Global Setup for E2E Tests
 * Task #015: E2E Test Comprehensive Implementation
 * 
 * Features:
 * - Database initialization and cleanup
 * - Test data seeding and management
 * - Authentication state preparation
 * - Performance baseline establishment
 * - Environment validation
 * - Resource allocation and monitoring
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Global Setup...');
  
  const startTime = Date.now();
  
  try {
    // ==============================================
    // 1. ENVIRONMENT VALIDATION
    // ==============================================
    await validateEnvironment();
    
    // ==============================================
    // 2. DATABASE SETUP & SEEDING
    // ==============================================
    await setupTestDatabase();
    
    // ==============================================
    // 3. AUTHENTICATION STATE PREPARATION
    // ==============================================
    await prepareAuthenticationStates();
    
    // ==============================================
    // 4. PERFORMANCE BASELINE ESTABLISHMENT
    // ==============================================
    await establishPerformanceBaseline();
    
    // ==============================================
    // 5. TEST DATA PREPARATION
    // ==============================================
    await prepareTestData();
    
    // ==============================================
    // 6. RESOURCE MONITORING SETUP
    // ==============================================
    await setupResourceMonitoring();
    
    // ==============================================
    // 7. CLEANUP PREPARATION
    // ==============================================
    await prepareCleanupHandlers();
    
    const endTime = Date.now();
    console.log(`✅ Global Setup completed successfully in ${endTime - startTime}ms`);
    
    // Save setup metadata
    await saveSetupMetadata({
      startTime,
      endTime,
      duration: endTime - startTime,
      environment: process.env.NODE_ENV || 'test',
      config: {
        baseURL: config.webServer?.url || process.env.PLAYWRIGHT_BASE_URL,
        workers: config.workers,
        retries: config.projects[0]?.retries
      }
    });
    
  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    throw error;
  }
}

async function validateEnvironment() {
  console.log('🔍 Validating environment...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validate application is running
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.goto(baseURL, { timeout: 30000 });
    
    // Verify basic application structure
    await page.waitForSelector('body', { timeout: 10000 });
    
    const title = await page.title();
    console.log(`📱 Application loaded: "${title}" at ${baseURL}`);
    
    await browser.close();
    
  } catch (error) {
    throw new Error(`Failed to connect to application at ${baseURL}: ${error}`);
  }
  
  console.log('✅ Environment validation completed');
}

async function setupTestDatabase() {
  console.log('🗄️ Setting up test database...');
  
  try {
    // Initialize test database schema
    // Note: In real implementation, this would connect to Supabase test instance
    console.log('📊 Initializing database schema...');
    
    // Seed test data
    console.log('🌱 Seeding test data...');
    
    // Create test users with different roles
    const testUsers = [
      {
        email: 'admin@test.example.com',
        role: 'admin',
        stores: ['store-001', 'store-002', 'store-003'],
        permissions: ['view', 'edit', 'export', 'manage']
      },
      {
        email: 'manager@test.example.com',
        role: 'manager', 
        stores: ['store-001', 'store-002'],
        permissions: ['view', 'edit', 'export']
      },
      {
        email: 'analyst@test.example.com',
        role: 'analyst',
        stores: ['store-001'],
        permissions: ['view', 'export']
      },
      {
        email: 'viewer@test.example.com',
        role: 'viewer',
        stores: ['store-001'],
        permissions: ['view']
      }
    ];
    
    // Save test users for later use
    await saveTestData('users', testUsers);
    
    // Create test sales data
    const testSalesData = generateTestSalesData();
    await saveTestData('sales', testSalesData);
    
    // Create test external data
    const testExternalData = generateTestExternalData();
    await saveTestData('external', testExternalData);
    
    console.log('✅ Database setup completed');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

async function prepareAuthenticationStates() {
  console.log('🔐 Preparing authentication states...');
  
  const browser = await chromium.launch();
  const authDir = path.join(__dirname, '../auth-states');
  
  try {
    // Ensure auth directory exists
    await fs.mkdir(authDir, { recursive: true });
    
    // Prepare authentication for different user roles
    const roles = ['admin', 'manager', 'analyst', 'viewer'];
    
    for (const role of roles) {
      console.log(`🔑 Preparing auth state for ${role}...`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Mock authentication state
      await page.addInitScript((userRole) => {
        const testUser = {
          admin: {
            id: 'admin-001',
            email: 'admin@test.example.com',
            role: 'admin',
            stores: ['store-001', 'store-002', 'store-003'],
            permissions: ['view', 'edit', 'export', 'manage']
          },
          manager: {
            id: 'manager-001', 
            email: 'manager@test.example.com',
            role: 'manager',
            stores: ['store-001', 'store-002'],
            permissions: ['view', 'edit', 'export']
          },
          analyst: {
            id: 'analyst-001',
            email: 'analyst@test.example.com', 
            role: 'analyst',
            stores: ['store-001'],
            permissions: ['view', 'export']
          },
          viewer: {
            id: 'viewer-001',
            email: 'viewer@test.example.com',
            role: 'viewer',
            stores: ['store-001'],
            permissions: ['view']
          }
        }[userRole];
        
        // Set authentication state
        window.localStorage.setItem('test-user', JSON.stringify(testUser));
        window.localStorage.setItem('authenticated', 'true');
        
        // Mock Supabase session
        window.localStorage.setItem('sb-session', JSON.stringify({
          access_token: `mock-token-${userRole}`,
          user: testUser,
          expires_at: Date.now() + 3600000 // 1 hour from now
        }));
        
      }, role);
      
      // Navigate to application to establish session
      await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
      
      // Wait for authentication to be established
      await page.waitForTimeout(1000);
      
      // Save authentication state
      await context.storageState({ 
        path: path.join(authDir, `${role}-auth.json`) 
      });
      
      await context.close();
      
      console.log(`✅ Auth state saved for ${role}`);
    }
    
  } finally {
    await browser.close();
  }
  
  console.log('✅ Authentication states prepared');
}

async function establishPerformanceBaseline() {
  console.log('📊 Establishing performance baseline...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const measurements: any = {};
    
    // Measure key page load times
    const pages = [
      { name: 'home', path: '/' },
      { name: 'dashboard', path: '/dashboard' },
      { name: 'sales', path: '/sales' },
      { name: 'analytics', path: '/analytics' },
      { name: 'export', path: '/export' },
      { name: 'audit', path: '/audit' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`📏 Measuring ${pageInfo.name} page...`);
      
      const startTime = Date.now();
      
      await page.goto(`${baseURL}${pageInfo.path}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait for main content
      await page.waitForSelector('h1', { timeout: 10000 });
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      measurements[pageInfo.name] = {
        loadTime,
        timestamp: new Date().toISOString(),
        url: `${baseURL}${pageInfo.path}`
      };
      
      console.log(`📏 ${pageInfo.name}: ${loadTime}ms`);
      
      // Get detailed performance metrics
      const perfMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
          loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
          firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime
        };
      });
      
      measurements[pageInfo.name] = { ...measurements[pageInfo.name], ...perfMetrics };
    }
    
    // Save baseline measurements
    await saveTestData('performance-baseline', measurements);
    
    console.log('✅ Performance baseline established');
    
  } finally {
    await browser.close();
  }
}

async function prepareTestData() {
  console.log('📋 Preparing test data...');
  
  const testDataDir = path.join(__dirname, '../test-data');
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Generate comprehensive test datasets
  const datasets = {
    stores: generateStoreData(),
    departments: generateDepartmentData(),
    products: generateProductData(),
    sales: generateTestSalesData(),
    external: generateTestExternalData(),
    audit: generateAuditLogData()
  };
  
  for (const [name, data] of Object.entries(datasets)) {
    await saveTestData(name, data);
    console.log(`📄 Test data prepared: ${name} (${Array.isArray(data) ? data.length : Object.keys(data).length} items)`);
  }
  
  console.log('✅ Test data preparation completed');
}

async function setupResourceMonitoring() {
  console.log('📊 Setting up resource monitoring...');
  
  // Create monitoring data structure
  const monitoring = {
    startTime: Date.now(),
    processes: [],
    memory: {
      initial: process.memoryUsage(),
      peak: process.memoryUsage(),
      samples: []
    },
    network: {
      requests: 0,
      responses: 0,
      errors: 0
    },
    performance: {
      slowQueries: [],
      errors: [],
      warnings: []
    }
  };
  
  // Start memory monitoring
  const memoryInterval = setInterval(() => {
    const current = process.memoryUsage();
    monitoring.memory.samples.push({
      timestamp: Date.now(),
      ...current
    });
    
    // Update peak memory usage
    if (current.heapUsed > monitoring.memory.peak.heapUsed) {
      monitoring.memory.peak = current;
    }
  }, 5000); // Sample every 5 seconds
  
  // Save monitoring setup
  await saveTestData('monitoring', monitoring);
  
  // Cleanup function
  global.cleanupMonitoring = () => {
    clearInterval(memoryInterval);
  };
  
  console.log('✅ Resource monitoring setup completed');
}

async function prepareCleanupHandlers() {
  console.log('🧹 Preparing cleanup handlers...');
  
  // Register cleanup handlers for various scenarios
  const cleanupHandlers = {
    database: async () => {
      console.log('🗄️ Cleaning up test database...');
      // Implementation would clean test data
    },
    files: async () => {
      console.log('📁 Cleaning up test files...');
      const tempDir = path.join(__dirname, '../temp');
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    },
    monitoring: async () => {
      console.log('📊 Stopping resource monitoring...');
      if (global.cleanupMonitoring) {
        global.cleanupMonitoring();
      }
    }
  };
  
  // Save cleanup handlers reference
  global.e2eCleanupHandlers = cleanupHandlers;
  
  console.log('✅ Cleanup handlers prepared');
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function generateStoreData() {
  return [
    { id: 'store-001', name: '渋谷店', address: '東京都渋谷区', lat: 35.6598, lng: 139.7006 },
    { id: 'store-002', name: '新宿店', address: '東京都新宿区', lat: 35.6895, lng: 139.6917 },
    { id: 'store-003', name: '池袋店', address: '東京都豊島区', lat: 35.7295, lng: 139.7109 }
  ];
}

function generateDepartmentData() {
  return [
    { id: 'electronics', name: '家電', description: '電化製品・PC・スマートフォン' },
    { id: 'clothing', name: '衣料品', description: 'ファッション・アパレル' },
    { id: 'food', name: '食品', description: '食料品・飲料・生鮮食品' },
    { id: 'books', name: '書籍', description: '本・雑誌・文具' }
  ];
}

function generateProductData() {
  return [
    { id: 'prod-001', name: 'スマートフォン', department: 'electronics', price: 89800 },
    { id: 'prod-002', name: 'ノートPC', department: 'electronics', price: 158000 },
    { id: 'prod-003', name: 'Tシャツ', department: 'clothing', price: 2980 },
    { id: 'prod-004', name: 'パン', department: 'food', price: 180 }
  ];
}

function generateTestSalesData() {
  const data = [];
  const startDate = new Date('2025-08-01');
  const endDate = new Date('2025-08-22');
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const stores = ['store-001', 'store-002', 'store-003'];
    const departments = ['electronics', 'clothing', 'food', 'books'];
    
    stores.forEach(store => {
      departments.forEach(department => {
        data.push({
          date: d.toISOString().split('T')[0],
          store_id: store,
          department,
          revenue_ex_tax: Math.floor(Math.random() * 100000) + 10000,
          footfall: Math.floor(Math.random() * 500) + 50,
          transactions: Math.floor(Math.random() * 200) + 20,
          discounts: Math.floor(Math.random() * 5000),
          tax: 0.1
        });
      });
    });
  }
  
  return data;
}

function generateTestExternalData() {
  return {
    market: [
      { date: '2025-08-22', symbol: 'TOPIX', value: 2850.5, change: 1.2 },
      { date: '2025-08-22', symbol: 'NIKKEI', value: 39250.8, change: -0.5 }
    ],
    weather: [
      { date: '2025-08-22', location: 'Tokyo', temp: 28.5, humidity: 65, precipitation: 0 },
      { date: '2025-08-22', location: 'Osaka', temp: 30.2, humidity: 70, precipitation: 2.1 }
    ],
    events: [
      { date: '2025-08-22', name: 'Summer Festival', location: 'Shibuya', type: 'festival' },
      { date: '2025-08-23', name: 'Tech Conference', location: 'Tokyo Big Sight', type: 'conference' }
    ]
  };
}

function generateAuditLogData() {
  return [
    {
      timestamp: new Date().toISOString(),
      user: 'admin@test.example.com',
      action: 'setup_test_environment',
      target: 'global_setup',
      ip: '127.0.0.1',
      userAgent: 'E2E-Test-Setup',
      metadata: { source: 'global-setup' }
    }
  ];
}

async function saveTestData(name: string, data: any) {
  const testDataDir = path.join(__dirname, '../test-data');
  await fs.mkdir(testDataDir, { recursive: true });
  
  const filePath = path.join(testDataDir, `${name}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function saveSetupMetadata(metadata: any) {
  const setupDir = path.join(__dirname, '../setup-metadata');
  await fs.mkdir(setupDir, { recursive: true });
  
  const filePath = path.join(setupDir, 'global-setup.json');
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
}

export default globalSetup;
