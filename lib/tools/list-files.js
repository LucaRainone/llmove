/* eslint-disable */
const fs = require('fs');
const path = require('path');

/**
 * Recursively get all files in given directories
 * @param {Object} parameters - Tool parameters
 * @param {Array<string>} parameters.dirs - Array of directory paths
 * @returns {Promise<string>} Array of file objects with path and relative path
 */
async function execute({ dirs }) {
  if (!Array.isArray(dirs)) {
    throw new Error('dirs parameter must be an array');
  }
  
  const allFiles = [];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory does not exist: ${dir}`);
      continue;
    }
    
    const files = await getAllFilesInDirectory(dir);
    allFiles.push(...files);
  }

  return '<files>\n'+ [... new Set(allFiles.map(({relativePath})=> relativePath))].map((relativePath)=> {
    return `<file>${relativePath}</file>`
  }).join("\n")+'</files>';
}

/**
 * Recursively get all files in a directory
 * @param {string} dirPath - Directory path
 * @param {string} basePath - Base path for relative path calculation
 * @returns {Promise<Array>} Array of file objects
 */
async function getAllFilesInDirectory(dirPath, basePath = dirPath) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const subFiles = await getAllFilesInDirectory(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Skip hidden files
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        const relativePath = path.relative(basePath, fullPath);
        const stats = fs.statSync(fullPath);
        
        files.push({
          path: fullPath,
          relativePath,
          name: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: path.extname(entry.name)
        });
      }
    }
  } catch (error) {
    console.warn(`Error reading directory ${dirPath}:`, error.message);
  }
  
  return files;
}

// Tool metadata for MCP registration
execute.description = "List all files in the specified directories recursively";
execute.parameters = {
  type: "object",
  properties: {
    dirs: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Array of directory paths to scan for files"
    }
  },
  required: ["dirs"]
};

module.exports = {
  execute,
  description: execute.description,
  parameters: execute.parameters
};
