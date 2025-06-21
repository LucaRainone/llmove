const fs = require('fs');
const path = require('path');

async function includeFiles(config, file, metadata) {
  const includes = [];
  const includeRegex = /^\s*<llmove:include ([^>]+)\s*\/>$/gm;
  let match;
  // Find all include tags
  while ((match = includeRegex.exec(file.content)) !== null) {
    const attributes = parseAttributes(match[1]);
    if (attributes.path) {
      includes.push({
        fullMatch: match[0],
        path: attributes.path,
        lines: attributes.lines,
        parse: attributes.parse === 'true'
      });
    }
  }

  if (includes.length === 0) {
    return {file, newFiles: []};
  }

  let modifiedContent = file.content;
  const newFiles = [];

  // Process each include
  for (const include of includes) {
    const basePath = path.dirname(file.path);
    const includePath = include.path.startsWith("/") ? path.resolve(process.cwd(), include.path.substring(1)) : path.resolve(basePath, include.path);
    try {
      // Resolve the path relative to the current file


      // Read the file
      let includeContent = fs.readFileSync(includePath, 'utf-8');

      // Apply line filtering if specified
      if (include.lines) {
        includeContent = filterLines(includeContent, include.lines);
      }

      // Replace the include tag with the content
      modifiedContent = modifiedContent.replace(include.fullMatch, includeContent);

      // If parse is true, add this file to be processed
      if (include.parse) {
        newFiles.push({
          path: includePath,
          content: includeContent
        });
      }
    } catch (error) {
      console.error(`Error including file ${includePath}: ${error.message}`);
      process.exit(1);
    }
  }

  return {
    file: {...file, content: modifiedContent},
    newFiles
  };
}

function parseAttributes(attributeString) {
  const attributes = {};
  const regex = /(\w+)=["']([^"']+)["']/g;
  let match;

  while ((match = regex.exec(attributeString)) !== null) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

function filterLines(content, lineSpec) {
  const lines = content.split('\n');
  const ranges = lineSpec.split(',').map(range => {
    const [start, end] = range.split(':').map(n => parseInt(n.trim(), 10));
    return {start: start - 1, end: end - 1}; // Convert to 0-based indexing
  });

  const filteredLines = [];

  for (const range of ranges) {
    for (let i = range.start; i <= range.end && i < lines.length; i++) {
      filteredLines.push(lines[i]);
    }
  }

  return filteredLines.join('\n');
}

module.exports = includeFiles;
