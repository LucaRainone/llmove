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
 * Typing simulation builder for streaming output
 * @returns {Array} - [addText function, endTyping promise]
 */
function typingSimulationBuilder() {
  let fullText = [];
  let streamEnded = false;
  let typeInProgress = true;

  const _f = () => {
    if (fullText.length > 0) {
      while(fullText.length > 0) {
        process.stdout.write(fullText.shift());
      }
    }
    if (fullText.length > 0 || !streamEnded) {
      setTimeout(() => {
        _f();
      }, 1);
    } else {
      typeInProgress = false;
    }
  };
  _f();

  return [
    function(text) {
      fullText.push(...text);
    },
    function() {
      streamEnded = true;
      return new Promise((resolve) => {
        const _check = () => {
          if (!typeInProgress) {
            resolve();
          } else {
            setTimeout(_check, 100);
          }
        };
        _check();
      });
    }
  ];
}

/**
 * Make a streaming API call for file generation
 * @param {Object} config - Configuration object
 * @param {string} system - System prompt
 * @param {string} prompt - User prompt
 * @returns {Promise<string>} - Complete response from API
 */
async function makeApiCall(config, system, prompt) {
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

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: fullPrompt }
  ];

  // Use streaming for real-time output
  console.log(`🚀 Starting streaming response...`);

  const stream = await createChatStream(config, messages);
  let fullResponse = '';

  const [addText, endTyping] = typingSimulationBuilder();

  if (isAnthropic) {
    // Handle Anthropic stream
    stream.on('text', (text) => {
      addText(text);
      fullResponse += text;
    });

    await stream.finalMessage();
  } else {
    // Handle OpenAI stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      addText(content);
      fullResponse += content;
    }
  }

  await endTyping();
  console.log('\n\n✅ Stream completed!');

  return fullResponse;
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

/**
 * Stream response from API with real-time display
 * @param {Object} config - Configuration object
 * @param {Array} messages - Message history
 * @returns {Promise<string>} - Complete response
 */
async function streamResponse(config, messages) {
  const stream = await createChatStream(config, messages);
  let fullResponse = '';

  const isAnthropic = config.apiUrl.includes('anthropic');
  const [addText, endTyping] = typingSimulationBuilder();

  if (isAnthropic) {
    // Handle Anthropic stream
    stream.on('text', (text) => {
      addText(text);
      fullResponse += text;
    });

    await stream.finalMessage();
  } else {
    // Handle OpenAI stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      addText(content);
      fullResponse += content;
    }
  }

  await endTyping();
  return fullResponse;
}

/**
 * Make a simple API call without streaming
 * @param {Object} config - Configuration object
 * @param {Array} messages - Message array
 * @returns {Promise<string>} Response content
 */
async function makeSimpleApiCall(config, messages) {
  const client = getClient(config);
  const isAnthropic = config.apiUrl.includes('anthropic');

  if (isAnthropic) {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await client.messages.create({
      model: config.model,
      system: systemMessage?.content || '',
      messages: userMessages,
      max_tokens: 1024
    });

    return response.content[0].text;
  } else {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: messages,
      max_tokens: 1024
    });

    return response.choices[0].message.content;
  }
}

module.exports = {
  makeApiCall,
  makeSimpleApiCall,
  createChatStream,
  getClient,
  streamResponse,
  typingSimulationBuilder
};
