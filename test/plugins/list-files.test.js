const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execute } = require('../../lib/tools/list-files');

// Helper function to create temporary test directory
function createTestDir() {
  const testDir = path.join(os.tmpdir(), 'llmove-test-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Helper function to clean up test directory
function cleanupTestDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper function to create test files
function createTestFiles(baseDir, structure) {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(baseDir, name);

    if (typeof content === 'string') {
      // It's a file
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content);
    } else if (typeof content === 'object') {
      // It's a directory
      fs.mkdirSync(fullPath, { recursive: true });
      createTestFiles(fullPath, content);
    }
  }
}

describe('list-files tool', () => {
  it('should list files in XML format for a single directory', async () => {
    const testDir = createTestDir();

    try {
      createTestFiles(testDir, {
        'file1.txt': 'content1',
        'file2.js': 'console.log("hello");',
        'subdir/file3.md': '# Title',
        'subdir/nested/file4.json': '{"key": "value"}'
      });

      const result = await execute({ dirs: [testDir] });

      // Test that result is a string
      assert.strictEqual(typeof result, 'string', 'Should return a string');

      // Test that it starts with <files> and ends with </files>
      assert.ok(result.startsWith('<files>'), 'Should start with <files>');
      assert.ok(result.endsWith('</files>'), 'Should end with </files>');

      // Count file entries
      const fileMatches = result.match(/<file>/g);
      assert.strictEqual(fileMatches.length, 4, `Should contain 4 file entries ${result}`);

      // Test that file entries contain expected attributes
      assert.ok(result.includes('file1.txt'), 'Should contain file1.txt');
      assert.ok(result.includes('file2.js'), 'Should contain file2.js');
      assert.ok(result.includes('file3.md'), 'Should contain file3.md');
      assert.ok(result.includes('file4.json'), 'Should contain file4.json');
    } finally {
      cleanupTestDir(testDir);
    }
  });

  it('should list files in XML format across multiple directories', async () => {
    const testDir1 = createTestDir();
    const testDir2 = createTestDir();

    try {
      createTestFiles(testDir1, {
        'dir1-file.txt': 'content'
      });

      createTestFiles(testDir2, {
        'dir2-file.txt': 'content',
        'subdir/another.js': 'code'
      });

      const result = await execute({ dirs: [testDir1, testDir2] });

      // Test that result is a string in XML format
      assert.strictEqual(typeof result, 'string', 'Should return a string');
      assert.ok(result.startsWith('<files>'), 'Should start with <files>');
      assert.ok(result.endsWith('</files>'), 'Should end with </files>');

      // Count file entries
      const fileMatches = result.match(/<file>/g);
      assert.strictEqual(fileMatches.length, 3, `Should contain 3 file entries across directories ${result}`);
    } finally {
      cleanupTestDir(testDir1);
      cleanupTestDir(testDir2);
    }
  });

  it('should handle non-existent directory gracefully', async () => {
    const result = await execute({ dirs: ['/non/existent/path'] });

    // Should return empty files XML structure
    assert.strictEqual(typeof result, 'string', 'Should return a string');
    assert.strictEqual(result.trim(), '<files>\n</files>', 'Should return empty XML structure for non-existent directory');
  });

  it('should skip hidden files and directories in XML output', async () => {
    const testDir = createTestDir();

    try {
      createTestFiles(testDir, {
        'visible.txt': 'content',
        '.hidden-file': 'hidden content',
        '.hidden-dir/file.txt': 'in hidden dir',
        'normal-dir/.hidden-in-normal': 'hidden in normal'
      });

      const result = await execute({ dirs: [testDir] });

      // Test XML structure
      assert.strictEqual(typeof result, 'string', 'Should return a string');
      assert.ok(result.startsWith('<files>'), 'Should start with <files>');
      assert.ok(result.endsWith('</files>'), 'Should end with </files>');

      // Count file entries (should only find visible files)
      const fileMatches = result.match(/<file>/g);
      assert.strictEqual(fileMatches.length, 1, 'Should only find 1 visible file');
      assert.ok(result.includes('visible.txt'), `Should find visible.txt`);

      // Ensure hidden files are not included
      assert.ok(!result.includes('.hidden-file'), 'Should not include hidden files');
      assert.ok(!result.includes('.hidden-dir'), 'Should not include hidden directories');
    } finally {
      cleanupTestDir(testDir);
    }
  });

  it('should include correct file attributes in XML', async () => {
    const testDir = createTestDir();

    try {
      createTestFiles(testDir, {
        'test.js': 'console.log("test");'
      });

      const result = await execute({ dirs: [testDir] });

      // Test that result is XML string
      assert.strictEqual(typeof result, 'string', 'Should return a string');

      // Test that file has expected attributes
      assert.ok(result.includes('test.js'), 'Should have name attribute');

      // Test closing tag
      assert.ok(result.includes('</file>'), 'Should have closing file tag');
    } finally {
      cleanupTestDir(testDir);
    }
  });

});
