const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Assuming the filterIdentity plugin exists
const filterIdentity = require('../../lib/plugins/filterIdentity.js');

describe('filterIdentity plugin', () => {
  it('should return the file unchanged', async () => {
    const config = { specFolder: 'specs' };
    const file = { 
      content: '<spec>test content</spec>',
      path: 'test.xml',
      metadata: { processed: true }
    };
    
    const result = await filterIdentity(config, file);
    
    assert.deepStrictEqual(result, file);
  });

  it('should handle empty file object', async () => {
    const config = { specFolder: 'specs' };
    const file = {};
    
    const result = await filterIdentity(config, file);
    
    assert.deepStrictEqual(result, file);
  });

  it('should handle file with only content', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'simple text' };
    
    const result = await filterIdentity(config, file);
    
    assert.deepStrictEqual(result, file);
  });

  it('should handle different config values', async () => {
    const configs = [
      { specFolder: 'specs' },
      { specFolder: 'different/path' },
      { specFolder: '' },
      {}
    ];
    
    const file = { content: 'test' };
    
    for (const config of configs) {
      const result = await filterIdentity(config, file);
      assert.deepStrictEqual(result, file, `Failed for config: ${JSON.stringify(config)}`);
    }
  });

  it('should return the same object reference', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'test' };
    
    const result = await filterIdentity(config, file);
    
    assert.strictEqual(result, file, 'Should return the same object reference');
  });
});
