/* eslint-disable */
const path = require('path');
const fs = require('fs').promises;

/**
 * Filter plugin that adds root.xml and conventions.xml files from current and parent directories
 * @param config
 * @param {{content: string, path:string, relativePath: string}[]} files - The files to process
 * @return {Promise<{content: string, path:string, relativePath: string}[]>}
 */
module.exports = async function filterAddRootConventions(config, files) {
  const addedPaths = new Set();
  const filesToAdd = [];
  
  // Special files to look for
  const specialFiles = ['root.xml', 'conventions.xml'];

  // remove specialFiles (they will be appended at the end only if needed)
  files = files.filter((file) => !file.path.endsWith(specialFiles[0]) && !file.path.endsWith(specialFiles[1]))
  
  // Get unique directories from existing files
  const directories = new Set();
  
  for (const file of files) {
    // Track all parent directories up to specs root
    let currentDir = path.dirname(file.path);
    const specsRoot = config.specsFolder;

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
        const relativePath = path.relative(path.join(process.cwd(), config.specsFolder), filePath);
        
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
  const getPriority = (file) => {
    if (file.relativePath.endsWith('root.xml')) return 0;
    if (file.relativePath.endsWith('conventions.xml')) return 1;
    return 2;
  };
  return [...files, ...filesToAdd].sort((a, b) => {


    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.relativePath.length - b.relativePath.length;
  });
};
