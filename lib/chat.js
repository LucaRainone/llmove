/* eslint-disable */
const readline = require('readline');
const { createChatStream } = require('./api');
const path = require('path');
const fs = require('fs').promises;

/**
 * Initialize readline interface
 * @returns {readline.Interface}
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n> '
  });
}

/**
 * Print welcome message
 */
function printWelcome() {
  console.log('\n🤖 Welcome to llmove chat!');
  console.log('Type your message and press Enter to send.');
  console.log('Type "exit" or press Ctrl+C to quit.\n');
}

/**
 * Load context from spec files
 * @param {string} specFolder - Path to specs folder
 * @returns {Promise<string>} - Combined context
 */
async function loadChatContext(specFolder) {
  const context = [];

  // Load conventions.xml if exists
  const conventionsPath = path.join(specFolder, 'conventions.xml');
  try {
    const conventions = await fs.readFile(conventionsPath, 'utf-8');
    context.push(conventions);
  } catch (err) {
    // File doesn't exist, skip
  }
  
  // Load root.xml if exists
  const rootPath = path.join(specFolder, 'root.xml');
  try {
    const root = await fs.readFile(rootPath, 'utf-8');
    context.push(`<root>\n${root}\n</root>`);
  } catch (err) {
    // File doesn't exist, skip
  }
  
  // Load chat.xml if exists (special system prompt)
  const chatPath = path.join(specFolder, 'chat.xml');
  try {
    const chat = await fs.readFile(chatPath, 'utf-8');
    context.push(`<chat_context>\n${chat}\n</chat_context>`);
  } catch (err) {
    // File doesn't exist, skip
  }
  
  return context.join('\n\n');
}

function typingSimulationBuilder() {
  let fullText = [];
  let streamEnded = false;
  let typeInProgress = true;
  const _f = ()=> {
    if(fullText.length > 0) {
      process.stdout.write(fullText.shift());
    }
    if(fullText.length > 0 || !streamEnded) {
      setTimeout(() => {
        _f()
      }, 10);
    }else {
      typeInProgress = false
    }
  }
  _f();
  return [function(text, ) {
    fullText.push(...text);
  }, function() {
    streamEnded = true;
    return new Promise((resolve) => {
      const _check = ()=> {
        if(!typeInProgress){
          resolve();
        }else {
          setTimeout(_check, 100);
        }
      }
      _check();
    })
  }];
}

/**
 * Stream response from API
 * @param {Object} config - Configuration object
 * @param {Array} messages - Message history
 * @returns {Promise<string>} - Complete response
 */
async function streamResponse(config, messages) {
  const stream = await createChatStream(config, messages);
  let fullResponse = '';
  
  const isAnthropic = config.apiUrl.includes('anthropic');
  const [addText, endTyping] = typingSimulationBuilder()
  if (isAnthropic) {
    // Handle Anthropic stream
    stream.on('text', (text) => {
      addText(text)
      fullResponse += text;
    });
    
    await stream.finalMessage();
  } else {
    // Handle OpenAI stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      addText(content)
      fullResponse += content;
    }
  }
  
  await endTyping();
  return fullResponse;
}

/**
 * Main chat function
 * @param {Object} config - Configuration object
 */
async function chat(config) {
  printWelcome();
  
  // Load context
  const context = await loadChatContext(config.specsFolder);
  const systemPrompt = `You are a helpful AI assistant for the \`llmove\` tool. You have access to the project's conventions and specifications, not sources.
You are currently interacting with the user via the command line. You cannot create or modify files, but only chat. 
You can generate the text of a xml file to put in spec folder but the user should do copy and paste of it.
The root node of xml must be <prompt> in case of a requirements, or <system> in case of context and system prompt.
Do not use Markdown unless you're outputting code examples or separating sections using titles/subtitles (with the \`#\` character).
Be as concise as possible. Emojis are allowed. ✅
  \n\n<full_chat_context>${context}</full_chat_context>`;
  // Initialize message history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Create readline interface
  const rl = createInterface();
  
  // Handle user input
  rl.on('line', async (input) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput.toLowerCase() === 'exit') {
      console.log('\nGoodbye! 👋');
      rl.close();
      process.exit(0);
    }
    
    if (trimmedInput === '') {
      rl.prompt();
      return;
    }
    
    // Add user message to history
    messages.push({ role: 'user', content: trimmedInput });
    
    try {
      console.log('\n🤔 Thinking...\n');
      
      // Get streaming response
      const response = await streamResponse(config, messages);
      
      // Add assistant response to history
      messages.push({ role: 'assistant', content: response });
      process.stdout.write("\n");

    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
    
    rl.prompt();
  });
  
  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log('\n\nGoodbye! 👋');
    rl.close();
    process.exit(0);
  });
  
  // Show initial prompt
  rl.prompt();
}

module.exports = { chat };
