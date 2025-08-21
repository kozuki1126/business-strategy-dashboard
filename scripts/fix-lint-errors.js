#!/usr/bin/env node

/**
 * Script to fix common ESLint errors in the project
 * Run with: node scripts/fix-lint-errors.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Patterns to replace console.log with logger
const consolePatterns = [
  { from: /console\.log\(/g, to: 'logger.log(' },
  { from: /console\.info\(/g, to: 'logger.info(' },
  { from: /console\.debug\(/g, to: 'logger.debug(' },
  { from: /console\.table\(/g, to: 'logger.table(' },
  { from: /console\.time\(/g, to: 'logger.time(' },
  { from: /console\.timeEnd\(/g, to: 'logger.timeEnd(' },
]

// Files to skip
const skipFiles = [
  'logger.ts',
  'fix-lint-errors.js',
  '.test.',
  '.spec.',
  'node_modules',
  '.next',
  'coverage',
]

// Function to process a file
function processFile(filePath) {
  // Skip if file should be ignored
  if (skipFiles.some(skip => filePath.includes(skip))) {
    return false
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false
    const originalContent = content

    // Only process .ts and .tsx files
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return false
    }

    // Replace console.* with logger.*
    consolePatterns.forEach(pattern => {
      if (pattern.from.test(content)) {
        content = content.replace(pattern.from, pattern.to)
        modified = true
      }
    })

    // Add logger import if modified and not already present
    if (modified && !content.includes('import { logger }') && !content.includes('import logger')) {
      const importStatement = "import { logger } from '@/lib/utils/logger'\n"
      
      // Find the right place to add import
      const firstImportMatch = content.match(/^import .*/m)
      if (firstImportMatch) {
        const position = content.indexOf(firstImportMatch[0])
        content = content.slice(0, position) + importStatement + content.slice(position)
      } else {
        content = importStatement + content
      }
    }

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✅ Fixed: ${filePath}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return false
  }
}

// Function to walk directory
function walkDirectory(dir) {
  let filesProcessed = 0
  let filesFixed = 0

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir)

    files.forEach(file => {
      const filePath = path.join(currentDir, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        // Skip node_modules and .next
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'coverage') {
          walk(filePath)
        }
      } else if (stat.isFile()) {
        filesProcessed++
        if (processFile(filePath)) {
          filesFixed++
        }
      }
    })
  }

  walk(dir)
  return { filesProcessed, filesFixed }
}

// Main execution
console.log('🔧 Starting ESLint error fixes...')
console.log('================================\n')

// Process src directory
const srcDir = path.join(process.cwd(), 'src')
if (fs.existsSync(srcDir)) {
  const { filesProcessed, filesFixed } = walkDirectory(srcDir)
  console.log(`\n📊 Results:`)
  console.log(`   Files processed: ${filesProcessed}`)
  console.log(`   Files fixed: ${filesFixed}`)
}

// Run ESLint fix
console.log('\n🔧 Running ESLint auto-fix...')
try {
  execSync('npx eslint . --fix --ext .js,.jsx,.ts,.tsx', { stdio: 'inherit' })
  console.log('✅ ESLint auto-fix completed')
} catch (error) {
  console.log('⚠️  Some ESLint errors could not be auto-fixed')
}

console.log('\n✨ Lint fix process completed!')
console.log('Run "npm run lint" to see remaining issues')
