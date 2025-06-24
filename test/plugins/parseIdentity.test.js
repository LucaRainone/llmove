const { describe, it } = require('node:test');
const assert = require('node:assert');

// Assuming the parseIdentity plugin exists
const parseIdentity = require('../../lib/plugins/parseIdentity.js');

describe('parseIdentity plugin', () => {
  it('should return content unchanged', async () => {
    const config = { specFolder: 'specs' };
    const content = '<spec>test content</spec>';
    const file = { path: 'test.xml' };
    
    const result = await parseIdentity(config, content, file);
    
    assert.strictEqual(result, content);
  });

  it('should handle empty content', async () => {
    const config = { specFolder: 'specs' };
    const content = '';
    const file = { path: 'test.xml' };
    
    const result = await parseIdentity(config, content, file);
    
    assert.strictEqual(result, '');
  });

  it('should handle various content types', async () => {
    const config = { specFolder: 'specs' };
    const file = { path: 'test.xml' };
    
    const testCases = [
      'plain text',
      '<xml>content</xml>',
      '{ "json": true }',
      'multi\nline\ncontent',
      '\t\tindented content',
      'special chars: <>&"'
    ];
    
    for (const content of testCases) {
      const result = await parseIdentity(config, content, file);
      assert.strictEqual(result, content, `Failed for content: ${content}`);
    }
  });

  it('should handle different file objects', async () => {
    const config = { specFolder: 'specs' };
    const content = 'test content';
    
    const files = [
      { path: 'test.xml' },
      { path: 'different.xml', metadata: { type: 'spec' } },
      { path: 'nested/path/file.xml' },
      {}
    ];
    
    for (const file of files) {
      const result = await parseIdentity(config, content, file);
      assert.strictEqual(result, content, `Failed for file: ${JSON.stringify(file)}`);
    }
  });

  it('should handle different config values', async () => {
    const content = 'test content';
    const file = { path: 'test.xml' };
    
    const configs = [
      { specFolder: 'specs' },
      { specFolder: 'different/path' },
      { specFolder: '', otherProp: true },
      {}
    ];
    
    for (const config of configs) {
      const result = await parseIdentity(config, content, file);
      assert.strictEqual(result, content, `Failed for config: ${JSON.stringify(config)}`);
    }
  });

  it('should handle large content', async () => {
    const config = { specFolder: 'specs' };
    const file = { path: 'test.xml' };
    const largeContent = 'x'.repeat(10000);
    
    const result = await parseIdentity(config, largeContent, file);
    
    assert.strictEqual(result, largeContent);
    assert.strictEqual(result.length, 10000);
  });
});
