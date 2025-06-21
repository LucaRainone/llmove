#!/usr/bin/env node
/* eslint-disable */
/* jshint ignore:start */
/* global require, process, console, module */

const fs = require('fs');
const path = require('path');
const { init } = require('./lib/init');
const { loadConfig } = require('./lib/config');
const { collectXmlFiles } = require('./lib/files');
const { runPlugins } = require('./lib/plugins');
const { makeApiCall } = require('./lib/api');
const { writeFiles, applyLastOutput } = require('./lib/output');
const { ensureDir } = require('./lib/utils');
const {parseContent, extractRootMetadata} = require("./lib/parser");

const CACHE_DIR = '.llmove';
const LAST_OUTPUT_FILE = path.join(CACHE_DIR, 'last-llmove-output.json');
const USER_PROMPTS_FILE = path.join(CACHE_DIR, 'userPrompts.txt');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'init') {
    await init();
    return;
  }

  const config = await loadConfig();
  if (!config) {
    console.error('Error: No configuration found. Run "llmove init" first.');
    process.exit(1);
  }

  ensureDir(CACHE_DIR);

  const isDryRun = args.includes('--dryRun');
  const isAgain = args.includes('--again');

  if (isAgain) {
    if (!fs.existsSync(LAST_OUTPUT_FILE)) {
      console.error('Error: No previous output found.');
      process.exit(1);
    }
    await applyLastOutput(LAST_OUTPUT_FILE);
    console.log('Files re-written from last output.');
    return;
  }
  const alreadyParsed = fs.readFileSync(USER_PROMPTS_FILE).toString().split("\n").filter(a => a);
  let xmlFiles = collectXmlFiles(config.specsFolder || 'specs');
  if (xmlFiles.length === 0) {
    console.error(`Error: No .xml files found in ${config.specsFolder || 'specs'}`);
    process.exit(1);
  }

  const metadata = extractRootMetadata(xmlFiles.find(a => a.relativePath === "root.xml").path);
  xmlFiles = xmlFiles.filter(file => !alreadyParsed.includes(file.relativePath)).map(f=>({...f, content: fs.readFileSync(f.path).toString()}));

  const newFiles = xmlFiles.map(file => file.relativePath)

  const {files} = await runPlugins(config, xmlFiles, metadata);

  const {system, prompt} = parseContent(files);

  if (isDryRun) {
    console.log('=== SYSTEM ===');
    console.log(system);
    console.log('\n=== PROMPT ===');
    console.log(prompt);
    return;
  }

  if (!prompt) {
    console.log("No new user prompt found.");
    return;
  }

  if (!config.apiKey) {
    console.error('Error: API_KEY not configured.');
    process.exit(1);
  }

  try {
    const response = await makeApiCall(config, system, prompt);
    const files = response.content[0].input.files;


    fs.writeFileSync(LAST_OUTPUT_FILE, JSON.stringify({files}, null, 2));
    fs.appendFileSync(USER_PROMPTS_FILE, "\n"+newFiles.join('\n'));

    await writeFiles(files);


    console.log(`Successfully generated ${files.length} file(s).`);
  } catch (error) {
    console.error(error);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
