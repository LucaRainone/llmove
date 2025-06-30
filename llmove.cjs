#!/usr/bin/env node
/* eslint-disable */
/* jshint ignore:start */
const { chat } = require('./lib/chat');

const fs = require('fs');
const path = require('path');
const { init, initProject} = require('./lib/init');
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
const LAST_OUTPUT_RESPONSE = path.join(CACHE_DIR, 'last-response.txt');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  let inlinePrompt = '';
  let isAgain = false;
  let isDryRun = false;

  const config = await loadConfig();
  if (command === 'configure') {
    await init();
    return;
  }

  if (command === 'init') {
    await initProject(config);
    return;
  }

  if (command === 'version') {
    console.log(require(__dirname+'/package.json').version);
    return;
  }

  if(command === "prompt") {
    if(args[1] === "--dryRun") {
      isDryRun = true;
      args[1] = "";
    }
    inlinePrompt = [...args.slice(1)].join(" ");
  }else if(command === "chat") {
    await chat(config);
    return ;
  }else {
    isDryRun = args.includes('--dryRun');
    isAgain = args.includes('--again');
  }

  if (!config) {
    console.error('Error: No configuration found. Run "llmove configure" first.');
    process.exit(1);
  }

  ensureDir(CACHE_DIR);
  if(!fs.existsSync(USER_PROMPTS_FILE)) {
    fs.writeFileSync(USER_PROMPTS_FILE, "");
  }



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

  if(inlinePrompt) {
      xmlFiles.push({
        path: __dirname+'/specs/inlineprompt.xml',
        relativePath: 'inlineprompt.xml',
        depth: 1,
        content: `<prompt>
${inlinePrompt}
</prompt>`,
      })
  }

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
  console.log(`Sending a request of ${(system.length + prompt.length)/4 >> 0 } tokens (approximately)`)


  if (!config.apiKey) {
    console.error('Error: API_KEY not configured.');
    process.exit(1);
  }

  try {
    const response = await makeApiCall(config, system, prompt);
    fs.writeFileSync(LAST_OUTPUT_RESPONSE, JSON.stringify(response, null , 2));
    // ensure is not an absolute path
    if(!response.content[0].input.files) {
      console.error(response.content);
      process.exit(1);
    }
    const files = response.content[0].input.files.map(f=>({...f, path: f.path.startsWith("/")? f.path.substring(1):f.path }));


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
