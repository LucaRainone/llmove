const { describe, it } = require('node:test');
const assert = require('node:assert');
const addNow = require('../../lib/plugins/addNow.js');

describe('addNow plugin', () => {
  it('should add runtime context to file content', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: '<spec>test content</spec>' };
    
    const result = await addNow(config, [file]);
    
    // Check that the file object is returned
    assert.strictEqual(result[0], file);
    const appendedFile = result[1]
    // Check that content was appended
    assert(appendedFile.content.includes('<system><runtime_context>'));
    assert(appendedFile.content.includes('unix_millis='));
    assert(appendedFile.content.includes('iso='));
    assert(appendedFile.content.includes('offset_ts='));
  });

  it('should add valid timestamp', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'original' };
    const beforeTime = Date.now();
    
    const files = await addNow(config, [file]);
    const afterTime = Date.now();
    const result = files[1];
    // Extract the unix_millis value
    const match = result.content.match(/unix_millis="(\d+)"/);
    assert(match, 'Should find unix_millis attribute');
    
    const timestamp = parseInt(match[1]);
    assert(timestamp >= beforeTime, 'Timestamp should be >= beforeTime');
    assert(timestamp <= afterTime, 'Timestamp should be <= afterTime');
  });

  it('should add valid ISO date', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'test' };
    
    const files = await addNow(config, [file]);
    const result = files[1];
    // Extract the ISO date
    const match = result.content.match(/iso="([^"]+)"/);
    assert(match, 'Should find iso attribute');
    
    const isoDate = match[1];
    const parsedDate = new Date(isoDate);
    assert(!isNaN(parsedDate.getTime()), 'Should be a valid date');
  });

  it('should add timezone offset', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'test' };

    const files = await addNow(config, [file]);
    const result = files[1];
    
    // Extract the offset_ts value
    const match = result.content.match(/offset_ts="(-?\d+)"/);
    assert(match, 'Should find offset_ts attribute');
    
    const offset = parseInt(match[1]);
    // Timezone offset should be between -720 and 840 (UTC-12 to UTC+14)
    assert(offset >= -720 && offset <= 840, 'Timezone offset should be valid');
  });

  it('should preserve original content', async () => {
    const config = { specFolder: 'specs' };
    const originalContent = '<xml>\n  <element>data</element>\n</xml>';
    const file = { content: originalContent };

    const files = await addNow(config, [file]);
    const result = files[0];
    
    assert(result.content.startsWith(originalContent));
  });

  it('should handle empty content', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: '' };

    const files = await addNow(config, [file]);
    const result = files[1];
    
    assert(result.content.includes('<system><runtime_context>'));
    assert(result.content.includes('</runtime_context></system>'));
  });

  it('should mutate the original file object', async () => {
    const config = { specFolder: 'specs' };
    const file = { content: 'test' };
    const originalFile = file;

    const files = await addNow(config, [file]);
    const result = files[0];
    
    assert.strictEqual(result, originalFile, 'Should return the same object reference');
    assert.strictEqual(file.content, result.content, 'Original file should be mutated');
  });
});
