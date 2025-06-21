/* eslint-disable */
const fs = require('fs');
const path = require('path');

function collectXmlFiles(dir, baseDir = dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      collectXmlFiles(fullPath, baseDir, files);
    } else if (entry.endsWith('.xml')) {
      const relativePath = path.relative(baseDir, fullPath);
      const depth = relativePath.split(path.sep).length - 1;
      const content = fs.readFileSync(fullPath, 'utf8');
      
      files.push({
        path: fullPath,
        relativePath,
        depth,
        content
      });
    }
  }
  
  // Sort by depth and then by path for deterministic order
  return files.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.relativePath.localeCompare(b.relativePath);
  });
}

module.exports = { collectXmlFiles };