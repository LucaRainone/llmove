#!/usr/bin/env node

/**
 * Test runner for the llmove CLI tool
 * Uses Node.js native test runner
 */

const { run } = require('node:test');
const { spec } = require('node:test/reporters');
const path = require('node:path');
const fs = require('node:fs');

// Get all test files
function getTestFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const testDir = path.join(__dirname);
const testFiles = getTestFiles(testDir);

console.log('Running tests...');
console.log(`Found ${testFiles.length} test files\n`);

// Run tests with spec reporter
run({ 
  files: testFiles,
  concurrency: true
})
  .compose(spec())
  .pipe(process.stdout);
