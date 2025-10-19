/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');
const { parseMarkdownResponse } = require("./markdown-parser");

/**
 * Validates that a file path is safe and within the project directory
 * @param {string} filePath - The file path to validate
 * @returns {string} - The normalized and validated path
 * @throws {Error} - If the path is unsafe
 */
function validateSafePath(filePath) {
  // Get the current working directory as our project root
  const projectRoot = process.cwd();
  
  // Normalize the input path to resolve any .. or . components
  const normalizedPath = path.normalize(filePath);
  
  // Resolve the absolute path
  const absolutePath = path.resolve(projectRoot, normalizedPath);
  
  // Ensure the resolved path is within the project directory
  if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
    throw new Error(`Unsafe path detected: ${filePath} resolves to ${absolutePath} which is outside the project directory`);
  }
  
  // Additional security checks
  if (normalizedPath.includes('..')) {
    throw new Error(`Path traversal detected in: ${filePath}`);
  }
  
  // Check for absolute paths that might bypass our validation
  if (path.isAbsolute(filePath) && !absolutePath.startsWith(projectRoot)) {
    throw new Error(`Absolute path outside project directory: ${filePath}`);
  }
  
  // Return the relative path from project root
  return path.relative(projectRoot, absolutePath);
}

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
  const projectRoot = process.cwd();
  
  for (const file of files) {
    try {
      // Validate the path is safe
      const safePath = validateSafePath(file.path);
      
      // Resolve to absolute path within project
      const absolutePath = path.resolve(projectRoot, safePath);
      
      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      ensureDir(dir);
      
      // Determine final path (with or without uniqueness)
      const finalPath = overwrite ? absolutePath : getUniqueFilename(absolutePath);
      
      // Final safety check on the final path
      const finalSafePath = validateSafePath(path.relative(projectRoot, finalPath));
      const finalAbsolutePath = path.resolve(projectRoot, finalSafePath);
      
      // Write the file
      fs.writeFileSync(finalAbsolutePath, file.content);
      console.log(`✓ Written: ${path.relative(projectRoot, finalAbsolutePath)}`);
      
    } catch (error) {
      console.error(`✗ Failed to write file ${file.path}: ${error.message}`);
      throw error;
    }
  }
}

async function applyLastOutput(outputFile) {
  try {
    // Validate the output file path is safe
    const safeOutputPath = validateSafePath(outputFile);
    const absoluteOutputPath = path.resolve(process.cwd(), safeOutputPath);
    
    const dataRow = fs.readFileSync(absoluteOutputPath, 'utf8');
    const { files, notes } = parseMarkdownResponse(dataRow);
    
    if (notes) {
      console.log("==== NOTES =====");
      console.log(notes);
    }
    
    await writeFiles(files);
  } catch (error) {
    console.error(`✗ Failed to apply output: ${error.message}`);
    throw error;
  }
}

module.exports = { writeFiles, applyLastOutput, validateSafePath };