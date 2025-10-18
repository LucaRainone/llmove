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

/**
 * Get available languages from assets/prompts directory
 * @returns {string[]} Array of available language codes
 */
function getAvailableLanguages() {
  const promptsDir = path.join(__dirname, '..', 'assets', 'prompts');

  if (!fs.existsSync(promptsDir)) {
    console.warn(`Warning: Prompts directory not found at ${promptsDir}`);
    return ['node']; // fallback to default
  }

  const files = fs.readdirSync(promptsDir);
  const languages = [];

  files.forEach(file => {
    if (file.endsWith('.root.xml')) {
      const lang = file.replace('.root.xml', '');
      languages.push(lang);
    }
  });

  return languages.length > 0 ? languages : ['node']; // fallback if no files found
}

/**
 * Display available languages and get user choice
 * @param {readline.Interface} rl
 * @param {string[]} languages
 * @returns {Promise<string>} Selected language
 */
async function selectLanguage(rl, languages) {
  console.log('\nAvailable languages:');
  languages.forEach((lang, index) => {
    console.log(`  ${index + 1}. ${lang}`);
  });

  while (true) {
    const choice = await question(rl, `\nSelect language (1-${languages.length}) or enter language name: `);

    // Check if it's a number
    const numChoice = parseInt(choice.trim());
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= languages.length) {
      return languages[numChoice - 1];
    }

    // Check if it's a valid language name
    const langChoice = choice.trim().toLowerCase();
    const foundLang = languages.find(lang => lang.toLowerCase() === langChoice);
    if (foundLang) {
      return foundLang;
    }

    console.log(`Invalid choice. Please select 1-${languages.length} or enter a valid language name.`);
  }
}

async function init() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`🚀 LLMove Configuration! Configuration will be stored in ${CONFIG_FILE}`);

  const apiKey = await question(rl, '\nEnter your Anthropic API key: ');
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

  await initProject(config);

  console.log('\n✅ Configuration saved successfully!');
  console.log(`Config location: ${CONFIG_FILE}`);

  rl.close();
}

async function initProject(config) {
  const version = require("../package.json").version;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  // Get available languages and let user choose
  const availableLanguages = getAvailableLanguages();
  const selectedLanguage = await selectLanguage(rl, availableLanguages);

  console.log(`\n✅ Selected language: ${selectedLanguage}`);

  ensureDir(config.specsFolder);
  console.log(`ensuring dir ${config.specsFolder}`)
  const rootFile = path.join(config.specsFolder, 'root.xml');
  const promptFile = path.join(__dirname, '..', 'assets', 'prompts', `${selectedLanguage}.root.xml`);

  // Check if the prompt file exists, fallback to node.root.xml if not
  let defaultContent;
  if (fs.existsSync(promptFile)) {
    defaultContent = fs.readFileSync(promptFile, 'utf8');
  } else {
    console.warn(`Warning: Prompt file for ${selectedLanguage} not found, using node.root.xml as fallback`);
    const fallbackFile = path.join(__dirname, '..', 'assets', 'prompts', 'node.root.xml');
    defaultContent = fs.readFileSync(fallbackFile, 'utf8');
  }

  if (!fs.existsSync(rootFile)) {
    fs.writeFileSync(rootFile, defaultContent.replace(/{{version}}/g, version));
    console.log(`\n✅ Created ${rootFile} with ${selectedLanguage} template.`);
  }
  rl.close();
}

module.exports = { init, CONFIG_FILE, initProject };
