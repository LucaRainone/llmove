/* eslint-disable */
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Initialize the appropriate client based on the API URL
 * @param {Object} config - Configuration object
 * @returns {OpenAI|Anthropic} - API client instance
 */
function getClient(config) {
  const isAnthropic = config.apiUrl.includes('anthropic');

  if (isAnthropic) {
    return new Anthropic({
      apiKey: config.apiKey,
    });
  } else {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl,
    });
  }
}

/**
 * Make a non-streaming API call for file generation
 * @param {Object} config - Configuration object
 * @param {string} system - System prompt
 * @param {string} prompt - User prompt
 * @returns {Promise<Object>} - API response
 */
async function makeApiCall(config, system, prompt) {
  const client = getClient(config);
  const isAnthropic = config.apiUrl.includes('anthropic');

  if (isAnthropic) {
    console.log(`Calling Anthropic API`);
    const response = await client.messages.create({
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
    return response;
  } else {
    console.log(`Calling OpenAI-compatible API`);
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'file_generator',
          description: 'Generate files with path and content',
          parameters: {
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
        }
      }],
      tool_choice: {
        type: 'function',
        function: { name: 'file_generator' }
      },
      max_tokens: 8192
    });
    return response;
  }
}

/**
 * Create a streaming chat completion
 * @param {Object} config - Configuration object
 * @param {Array} messages - Array of message objects
 * @returns {Promise<AsyncIterable>} - Stream of completion chunks
 */
async function createChatStream(config, messages) {
  const client = getClient(config);
  const isAnthropic = config.apiUrl.includes('anthropic');

  if (isAnthropic) {
    // Extract system message from messages array
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    return client.messages.stream({
      model: config.model,
      system: systemMessage?.content || '',
      messages: userMessages,
      max_tokens: 8192
    });
  } else {
    return await client.chat.completions.create({
      model: config.model,
      messages: messages,
      stream: true,
      max_tokens: 8192
    });
  }
}

module.exports = { makeApiCall, createChatStream, getClient };
