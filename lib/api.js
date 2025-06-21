/* eslint-disable */
const https = require('https');
const { URL } = require('url');

function makeApiCall(config, system, prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL('/v1/messages', config.apiUrl);
    
    const isAnthropic = url.hostname.includes('anthropic');
    
    const headers = {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json'
    };
    
    if (isAnthropic) {
      headers['anthropic-version'] = '2023-06-01';
    }
    
    const data = JSON.stringify({
      model: config.model,
      system: system,
      messages: [{
        role: 'user',
        content: prompt
      }],
      tools: [{
        name: 'file_generator',
        description: 'Generate files with path and content',
        input_schema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['path', 'content']
              }
            }
          },
          required: ['files']
        }
      }],
      tool_choice: {
        type: 'tool',
        name: 'file_generator'
      },
      max_tokens: 8192
    });
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: headers
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          if (res.statusCode !== 200) {
            reject(new Error(`API error (${res.statusCode}): ${response.error?.message || body}`));
            return;
          }
          
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = { makeApiCall };