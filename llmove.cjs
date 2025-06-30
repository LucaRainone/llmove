#!/usr/bin/env node
/* eslint-disable */
/* jshint ignore:start */
const { program } = require('commander');
const { chat } = require('./lib/chat');
const fs = require('fs');
const path = require('path');
const { init, initProject } = require('./lib/init');
const { loadConfig } = require('./lib/config');
const { collectXmlFiles } = require('./lib/files');
const { runPlugins } = require('./lib/plugins');
const { makeApiCall } = require('./lib/api');
const { writeFiles, applyLastOutput } = require('./lib/output');
const { ensureDir } = require('./lib/utils');
const { parseContent, extractRootMetadata } = require('./lib/parser');

const CACHE_DIR = '.llmove';
const LAST_OUTPUT_FILE = path.join(CACHE_DIR, 'last-llmove-output.json');
const USER_PROMPTS_FILE = path.join(CACHE_DIR, 'userPrompts.txt');
const LAST_OUTPUT_RESPONSE = path.join(CACHE_DIR, 'last-response.txt');

const pkg = require('./package.json');

// Configure main program
program
 .name('llmove')
 .description('CLI tool to process XML specification files and generate code via LLM')
 .version(pkg.version);

// Configure command
program
 .command('configure')
 .description('Configure API settings')
 .action(async () => {
   await init();
 });

// Init command
program
 .command('init')
 .description('Initialize project structure')
 .action(async () => {
   const config = await loadConfig();
   await initProject(config);
 });

// Chat command
program
 .command('chat')
 .description('Start interactive chat mode')
 .action(async () => {
   const config = await loadConfig();
   await chat(config);
 });

// Prompt command
program
 .command('prompt <message...>')
 .description('Send an inline prompt')
 .option('--dryRun', 'Show what would be sent without making API call')
 .action(async (message, options) => {
   const config = await loadConfig();
   const inlinePrompt = message.join(' ');
   await processFiles(config, {
     inlinePrompt,
     isDryRun: options.dryRun || false
   });
 });

// Default run command (when no command specified)
program
 .command('run', { isDefault: true })
 .description('Process XML files in specs folder')
 .option('--dryRun', 'Show what would be sent without making API call')
 .option('--again', 'Re-apply last output files')
 .action(async (options) => {
   const config = await loadConfig();

   if (options.again) {
     await reapplyLastOutput();
     return;
   }

   await processFiles(config, {
     isDryRun: options.dryRun || false
   });
 });

// Main processing function
async function processFiles(config, options = {}) {
  const { inlinePrompt = '', isDryRun = false } = options;

  if (!config) {
    console.error('Error: No configuration found. Run "llmove configure" first.');
    process.exit(1);
  }

  ensureDir(CACHE_DIR);
  if (!fs.existsSync(USER_PROMPTS_FILE)) {
    fs.writeFileSync(USER_PROMPTS_FILE, '');
  }

  const alreadyParsed = fs.readFileSync(USER_PROMPTS_FILE)
   .toString()
   .split('\n')
   .filter(a => a);

  let xmlFiles = collectXmlFiles(config.specsFolder || 'specs');

  if (xmlFiles.length === 0) {
    console.error(`Error: No .xml files found in ${config.specsFolder || 'specs'}`);
    process.exit(1);
  }

  const rootFile = xmlFiles.find(a => a.relativePath === 'root.xml');
  if (!rootFile) {
    console.error('Error: root.xml not found in specs folder');
    process.exit(1);
  }

  const metadata = extractRootMetadata(rootFile.path);
  xmlFiles = xmlFiles
   .filter(file => !alreadyParsed.includes(file.relativePath))
   .map(f => ({ ...f, content: fs.readFileSync(f.path).toString() }));

  if (inlinePrompt) {
    xmlFiles.push({
      path: path.join(__dirname, 'specs/inlineprompt.xml'),
      relativePath: 'inlineprompt.xml',
      depth: 1,
      content: `<prompt>\n${inlinePrompt}\n</prompt>`,
    });
  }

  const newFiles = xmlFiles.map(file => file.relativePath);
  const { files } = await runPlugins(config, xmlFiles, metadata);
  const { system, prompt } = parseContent(files);

  if (isDryRun) {
    console.log('=== SYSTEM ===');
    console.log(system);
    console.log('\n=== PROMPT ===');
    console.log(prompt);
    return;
  }

  if (!prompt) {
    console.log('No new user prompt found.');
    return;
  }

  console.log(`User prompt of ${(system.length + prompt.length) / 4 >> 0} tokens (approximately).`);

  if (!config.apiKey) {
    console.error('Error: API_KEY not configured.');
    process.exit(1);
  }

  try {
    const response = await makeApiCall(config, system, prompt);
    fs.writeFileSync(LAST_OUTPUT_RESPONSE, JSON.stringify(response, null, 2));

    if (!response.content[0].input.files) {
      console.error(response.content);
      process.exit(1);
    }

    const files = response.content[0].input.files.map(f => ({
      ...f,
      path: f.path.startsWith('/') ? f.path.substring(1) : f.path
    }));

    fs.writeFileSync(LAST_OUTPUT_FILE, JSON.stringify({ files }, null, 2));
    fs.appendFileSync(USER_PROMPTS_FILE, '\n' + newFiles.join('\n'));

    await writeFiles(files);
    console.log(`Successfully generated ${files.length} file(s).`);
  } catch (error) {
    console.error(error);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Function to reapply last output
async function reapplyLastOutput() {
  if (!fs.existsSync(LAST_OUTPUT_FILE)) {
    console.error('Error: No previous output found.');
    process.exit(1);
  }
  await applyLastOutput(LAST_OUTPUT_FILE);
  console.log('Files re-written from last output.');
}

// Parse arguments and run
program.parse(process.argv);
