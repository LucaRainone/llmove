/* eslint-disable */
const fs = require('fs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

module.exports = { ensureDir, sleep, question};
