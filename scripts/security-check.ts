#!/usr/bin/env tsx

/**
 * Security check script for the project
 * Validates common security configurations and dependencies
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SecurityCheck {
  name: string;
  check: () => boolean;
  errorMessage: string;
}

const checks: SecurityCheck[] = [
  {
    name: 'Next.js security headers',
    check: () => {
      try {
        const configPath = join(process.cwd(), 'next.config.mjs');
        if (!existsSync(configPath)) return false;
        
        const config = readFileSync(configPath, 'utf-8');
        return config.includes('X-Frame-Options') && 
               config.includes('X-Content-Type-Options') &&
               config.includes('Referrer-Policy');
      } catch {
        return false;
      }
    },
    errorMessage: 'Next.js security headers not properly configured'
  },
  {
    name: 'Environment variables protection',
    check: () => {
      const gitignorePath = join(process.cwd(), '.gitignore');
      if (!existsSync(gitignorePath)) return false;
      
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      return gitignore.includes('.env') && gitignore.includes('.env.local');
    },
    errorMessage: 'Environment files not properly ignored in .gitignore'
  },
  {
    name: 'TypeScript strict mode',
    check: () => {
      try {
        const tsconfigPath = join(process.cwd(), 'tsconfig.json');
        if (!existsSync(tsconfigPath)) return false;
        
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        return tsconfig.compilerOptions?.strict === true;
      } catch {
        return false;
      }
    },
    errorMessage: 'TypeScript strict mode not enabled'
  }
];

function runSecurityChecks(): void {
  console.log('🔒 Running security checks...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      if (check.check()) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}: ${check.errorMessage}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${check.name}: Error running check - ${error}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Security check results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some security checks failed. Please address the issues above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All security checks passed!');
  }
}

if (require.main === module) {
  runSecurityChecks();
}

export { runSecurityChecks };