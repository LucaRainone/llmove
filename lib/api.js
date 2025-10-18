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
 * Make a non-streaming API call for file generation using plain text response
 * @param {Object} config - Configuration object
 * @param {string} system - System prompt
 * @param {string} prompt - User prompt
 * @returns {Promise<string>} - Raw text response from API
 */
async function makeApiCall(config, system, prompt) {
  const client = getClient(config);
  const isAnthropic = config.apiUrl.includes('anthropic');

  const fileGenerationTemplate = `Please generate the files based on the specifications provided. Respond in markdown format with the following structure:

# Generated Files

For each file, use this exact format:

## File: path/to/filename.ext
\`\`\`
file content here
\`\`\`

Example:
## File: src/components/Button.jsx
\`\`\`jsx
import React from 'react';

export default function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}
\`\`\`

Make sure to:
1. Use exactly "## File: " followed by the file path
2. Wrap all file content in code blocks with appropriate language tags
3. Include all necessary files to fulfill the specification
`;

  const fullPrompt = `${prompt}\n\n${fileGenerationTemplate}`;

  if (isAnthropic) {
    console.log(`Calling Anthropic API`);
    const response = await client.messages.create({
      model: config.model,
      system: system,
      messages: [{
        role: 'user',
        content: fullPrompt
      }],
      max_tokens: 8192
    });
    return response.content[0].text;
  } else {
    console.log(`Calling OpenAI-compatible API`);
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: fullPrompt }
      ],
      max_tokens: 8192
    });
    return response.choices[0].message.content;
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
