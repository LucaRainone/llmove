/* eslint-disable */
const path = require('path');
const fs = require('fs').promises;

/**
 * Filter plugin that adds root.xml and conventions.xml files from current and parent directories
 * @param {{content: string, path:string, relativePath: string}[]} files - The files to process
 * @return {Promise<{content: string, path:string, relativePath: string}[]>}
 */
module.exports = async function filterAddRootConventions(config, files) {
  const addedPaths = new Set();
  const filesToAdd = [];
  
  // Special files to look for
  const specialFiles = ['root.xml', 'conventions.xml'];
  
  // Get unique directories from existing files
  const directories = new Set();
  
  for (const file of files) {
    // Track all parent directories up to specs root
    let currentDir = path.dirname(file.path);
    const specsRoot = 'specs';

    while (currentDir.startsWith(specsRoot)) {
      directories.add(currentDir);
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }
  }

  // Check each directory for special files
  for (const dir of directories) {
    for (const specialFile of specialFiles) {
      const filePath = path.join(dir, specialFile);
      
      // Skip if already in the original files list
      const alreadyExists = files.some(f => f.path === filePath);
      if (alreadyExists || addedPaths.has(filePath)) continue;
      
      try {
        // Check if file exists
        await fs.access(filePath);
        
        // Read the file content
        const content = await fs.readFile(filePath, 'utf8');
        const relativePath = path.relative(path.join(process.cwd(), 'specs'), filePath);
        
        filesToAdd.push({
          content,
          path: filePath,
          relativePath
        });
        
        addedPaths.add(filePath);
      } catch (error) {
        // File doesn't exist, skip it
      }
    }
  }
  
  // Return original files plus any special files found
  return [...files, ...filesToAdd];
};
