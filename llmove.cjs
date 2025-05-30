#!/usr/bin/env node
/* eslint-disable */
/* jshint ignore:start */
/* globals require, process, module, exports, console, Buffer */
/*
  This script is released under CC0 1.0 Universal (Public Domain Dedication).
  You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.

  Full legal text: https://creativecommons.org/publicdomain/zero/1.0/
*/

const fs = require('fs');
const path = require('path');
const https = require('https');
const {URL} = require('url');

try {
  require.resolve('dotenv');
  require('dotenv').config();
  console.log("dotenv package recognized: .env included automatically if there")
}catch(err) {
  // ignore.
}

// Constants
const SPECS_DIR = process.env.LLMOVE_SPECS_DIR || 'specs';
const CACHE_DIR = '.llmove';
const LAST_OUTPUT_FILE = path.join(CACHE_DIR, 'last-llmove-output.json');
const USER_PROMPTS_FILE = path.join(CACHE_DIR, 'userPrompts.txt');
const DEFAULT_API_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dryRun'),
    again: args.includes('--again')
  };
}

// Get environment variables with LLMOVE_ prefix
function getEnvConfig() {
  return {
    apiKey: process.env.LLMOVE_API_KEY,
    apiUrl: process.env.LLMOVE_API_URL || DEFAULT_API_URL,
    apiModel: process.env.LLMOVE_API_MODEL || DEFAULT_MODEL
  };
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {recursive: true});
  }
}

// Read file with error handling
function readFileSync(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

// Write file with timestamp if exists
function writeFileWithTimestamp(filePath, content) {
  ensureDir(path.dirname(filePath));

  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    filePath = path.join(dir, `${base}_${timestamp}${ext}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Written: ${filePath}`);
}

// Get all XML files recursively with depth
function getAllXmlFiles(dir, depth = 0, result = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllXmlFiles(fullPath, depth + 1, result);
    } else if (file.endsWith('.xml')) {
      result.push({path: fullPath, name: file, depth});
    }
  }

  return result;
}

// Clean XML content
function cleanXmlContent(content, filePath) {
  if (!content) return '';

  // Process includes recursively
  content = processIncludes(content, path.dirname(filePath));

  // Remove unwanted tags and their content
  const tagsToRemove = ['file', 'include', 'assistant'];
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gs');
    content = content.replace(regex, '');
  }

  // Remove code blocks
  content = content.replace(/```[\s\S]*?```/g, '');

  // Trim whitespace
  return content.trim();
}

function processIncludes(content, basePath) {

  const parseLineRanges = (rangeStr) => {
    return rangeStr.split(',').map(part => {
      const [start, end] = part.split(':').map(n => parseInt(n, 10));
      return {start, end};
    });
  }

  const extractLines = (content, lineRanges) => {
    const lines = content.split('\n');
    let extracted = [];

    for (const range of lineRanges) {
      const start = Math.max(1, range.start) - 1; // convert to 0-based
      const end = Math.min(lines.length, range.end);
      extracted.push(...lines.slice(start, end));
    }

    return extracted.join('\n');
  }

  const includeRegex = /<include[^>]*path="([^"]+)"(?:[^>]*lines="([^"]+)")?[^>]*\/>/g;
  let match;

  while ((match = includeRegex.exec(content)) !== null) {
    const includePath = match[1];
    const linesAttr = match[2];
    const fullIncludePath = path.join(basePath, includePath);
    let includeContent;

    try {
      includeContent = fs.readFileSync(fullIncludePath, 'utf-8');
    } catch (e) {
      includeContent = null;
    }

    if (includeContent) {
      if (linesAttr) {
        const lineRanges = parseLineRanges(linesAttr);
        includeContent = extractLines(includeContent, lineRanges);
      }

      // Ricorsione su eventuali include nidificati
      const processedContent = processIncludes(includeContent, path.dirname(fullIncludePath));
      content = content.replace(match[0], processedContent);
    } else {
      content = content.replace(match[0], '');
    }
  }

  return content;
}


// Read processed prompts
function getProcessedPrompts() {
  if (!fs.existsSync(USER_PROMPTS_FILE)) {
    return new Set();
  }

  const content = readFileSync(USER_PROMPTS_FILE);
  return new Set(content.split('\n').filter(line => line.trim()));
}

// Save processed prompt
function saveProcessedPrompt(promptPath) {
  ensureDir(CACHE_DIR);
  fs.appendFileSync(USER_PROMPTS_FILE, promptPath + '\n', 'utf8');
}

// Make API request
function makeApiRequest(config, systemContent, userContent) {
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

    const requestBody = {
      model: config.apiModel,
      max_tokens: 8192,
      system: systemContent,
      messages: [{
        role: 'user',
        content: userContent
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
                  path: {type: 'string'},
                  content: {type: 'string'}
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
      }
    };

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        } else {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

// Extract files from API response
function extractFilesFromResponse(response) {
  if (!response.content || !Array.isArray(response.content)) {
    throw new Error('Invalid API response structure');
  }

  for (const item of response.content) {
    if (item.type === 'tool_use' && item.name === 'file_generator') {
      return item.input.files || [];
    }
  }

  return [];
}

// Write files from API response
function writeFiles(files) {
  for (const file of files) {
    if (file.path && file.content) {
      writeFileWithTimestamp(file.path, file.content);
    }
  }
}

// Apply last output again
function applyLastOutput() {
  if (!fs.existsSync(LAST_OUTPUT_FILE)) {
    console.error('No previous output found in', LAST_OUTPUT_FILE);
    process.exit(1);
  }

  const content = readFileSync(LAST_OUTPUT_FILE);
  try {
    const data = JSON.parse(content);
    if (data.files && Array.isArray(data.files)) {
      writeFiles(data.files);
      console.log('Applied last output successfully');
    } else {
      console.error('Invalid last output format');
    }
  } catch (error) {
    console.error('Failed to parse last output:', error.message);
    process.exit(1);
  }
}

// Main function
async function main() {
  const args = parseArgs();
  const config = getEnvConfig();

  // Handle --again flag
  if (args.again) {
    applyLastOutput();
    return;
  }

  // Check for specs directory
  if (!fs.existsSync(SPECS_DIR)) {
    console.error(`Directory '${SPECS_DIR}' not found`);
    process.exit(1);
  }

  // Get all XML files
  const xmlFiles = getAllXmlFiles(SPECS_DIR);
  if (xmlFiles.length === 0) {
    console.log('No XML files found in specs directory');
    return;
  }

  // Sort files by depth and name
  xmlFiles.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });

  // Categorize files
  const systemFiles = [];
  const contextFiles = [];
  const promptFiles = [];

  for (const file of xmlFiles) {
    if (file.name === 'root.xml' || file.name === 'conventions.xml') {
      systemFiles.push(file);
    } else if (file.name.startsWith('context')) {
      contextFiles.push(file);
    } else {
      promptFiles.push(file);
    }
  }

  // Process system and context files
  let systemContent = '';
  for (const file of [...systemFiles, ...contextFiles]) {
    const content = readFileSync(file.path);
    if (content) {
      const cleaned = cleanXmlContent(content, file.path);
      if (cleaned) {
        systemContent += cleaned + '\n\n';
      }
    }
  }

  // Filter out already processed prompts
  const processedPrompts = getProcessedPrompts();
  const newPromptFiles = promptFiles.filter(file => !processedPrompts.has(file.path));

  if (newPromptFiles.length === 0) {
    console.log('No new prompt files to process');
    return;
  }

  // Process prompt files
  let userContent = '';
  for (const file of newPromptFiles) {
    const content = readFileSync(file.path);
    if (content) {
      const cleaned = cleanXmlContent(content, file.path);
      if (cleaned) {
        userContent += cleaned + '\n\n';
      }
    }
  }

  // Handle dry run
  if (args.dryRun) {
    console.log('=== SYSTEM CONTENT ===');
    console.log(systemContent);
    console.log('\n=== USER CONTENT ===');
    console.log(userContent);
    return;
  }

  // Check API key
  if (!config.apiKey) {
    console.error('Error: LLMOVE_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Make API request
  console.log('Sending request to API...');
  try {
    const response = await makeApiRequest(config, systemContent, userContent);
    const files = extractFilesFromResponse(response);

    if (files.length === 0) {
      console.log('No files generated by the API');
      return;
    }

    // Cache the response
    ensureDir(CACHE_DIR);
    fs.writeFileSync(LAST_OUTPUT_FILE, JSON.stringify({files}, null, 2), 'utf8');

    // Write files
    writeFiles(files);

    // Mark prompts as processed
    for (const file of newPromptFiles) {
      saveProcessedPrompt(file.path);
    }

    console.log(`Successfully generated ${files.length} file(s)`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
