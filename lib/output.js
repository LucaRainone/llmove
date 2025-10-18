/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');
const {parseMarkdownResponse} = require("./markdown-parser");

function getUniqueFilename(filePath) {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return path.join(dir, `${base}_${timestamp}${ext}`);
}

async function writeFiles(files, overwrite = false) {
  for (const file of files) {
    const dir = path.dirname(file.path);
    ensureDir(dir);
    const finalPath = overwrite? file.path : getUniqueFilename(file.path)
    fs.writeFileSync(finalPath, file.content);
    console.log(`✓ Written: ${finalPath}`);
  }
}

async function applyLastOutput(outputFile) {
  const dataRow = fs.readFileSync(outputFile, 'utf8');
  const {files, notes} = parseMarkdownResponse(dataRow);
  if(notes) {
    console.log("==== NOTES =====")
    console.log(notes)
  }
  await writeFiles(files);
}

module.exports = { writeFiles, applyLastOutput };
