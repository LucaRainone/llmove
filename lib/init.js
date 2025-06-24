/* eslint-disable */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ensureDir } = require('./utils');

const CONFIG_DIR = path.join(os.homedir(), '.llmove');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_MODEL = 'claude-opus-4-20250514';
function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function init() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(`🚀 LLMove Configuration! Configuration will be stored in ${CONFIG_FILE}`);
  
  const apiKey = await question(rl, 'Enter your Anthropic API key: ');
  if (!apiKey.trim()) {
    console.error('Error: API key is required.');
    rl.close();
    process.exit(1);
  }
  
  const model = await question(rl, `Enter model name (default: ${DEFAULT_MODEL}): `);
  const specsFolder = await question(rl, 'Enter specs folder path (default: specs): ');
  
  const config = {
    apiKey: apiKey.trim(),
    model: model.trim() || DEFAULT_MODEL,
    specsFolder: specsFolder.trim() || 'specs',
    version: require(path.join(__dirname, '..','package.json')).version,
  };
  
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_FILE, 0o600);
  
  ensureDir(config.specsFolder);

  initProject(config);

  console.log('\n✅ Configuration saved successfully!');
  console.log(`Config location: ${CONFIG_FILE}`);
  
  rl.close();
}

function initProject(config) {
  ensureDir(config.specsFolder)
  const rootFile = path.join(config.specsFolder, 'root.xml');
  const defaultContent = fs.readFileSync(path.join(__dirname, '..', 'assets', 'default.root.xml'), 'utf8');

  if (!fs.existsSync(rootFile)) {
    fs.writeFileSync(rootFile, defaultContent.replace(/{{version}}/g, config.version));
    console.log(`\n✅ Created ${rootFile} with default content.`);
  }
}

module.exports = { init, CONFIG_FILE, initProject };
