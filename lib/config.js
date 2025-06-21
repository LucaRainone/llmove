/* eslint-disable */
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.llmove');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  // Check environment variables first
  const envConfig = {
    apiKey: process.env.LLMOVE_API_KEY,
    apiUrl: process.env.LLMOVE_API_URL,
    model: process.env.LLMOVE_API_MODEL
  };
  
  // Load from file
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        apiKey: envConfig.apiKey || fileConfig.apiKey,
        apiUrl: envConfig.apiUrl || fileConfig.apiUrl || 'https://api.anthropic.com',
        model: envConfig.model || fileConfig.model || 'claude-3-opus-20240229',
        specsFolder: fileConfig.specsFolder || 'specs'
      };
    } catch (error) {
      console.error('Error reading config file:', error.message);
      return null;
    }
  }
  
  // Return env-only config if no file exists
  if (envConfig.apiKey) {
    return {
      apiKey: envConfig.apiKey,
      apiUrl: envConfig.apiUrl || 'https://api.anthropic.com',
      model: envConfig.model || 'claude-3-opus-20240229',
      specsFolder: 'specs'
    };
  }
  
  return null;
}

module.exports = { loadConfig };