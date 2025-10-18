/* eslint-disable */

/**
 * Parse markdown response and extract file definitions
 * @param {string} markdownContent - Raw markdown response from LLM
 * @returns {Array<{path: string, content: string}>} - Array of file objects
 */
function parseMarkdownResponse(markdownContent) {
  const files = [];
  const lines = markdownContent.split('\n');
  
  let currentFile = null;
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLanguage = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for file header: ## File: path/to/file.ext
    const fileHeaderMatch = line.match(/^##\s+File:\s*(.+)$/);
    if (fileHeaderMatch) {
      // Save previous file if exists
      if (currentFile && inCodeBlock) {
        currentFile.content = codeBlockContent.join('\n');
        files.push(currentFile);
      }
      
      // Start new file
      currentFile = {
        path: fileHeaderMatch[1].trim(),
        content: ''
      };
      inCodeBlock = false;
      codeBlockContent = [];
      continue;
    }
    
    // Check for code block start
    const codeBlockStartMatch = line.match(/^```(\w*)/);
    if (codeBlockStartMatch && currentFile && !inCodeBlock) {
      inCodeBlock = true;
      codeBlockLanguage = codeBlockStartMatch[1] || '';
      codeBlockContent = [];
      continue;
    }
    
    // Check for code block end
    if (line.match(/^```$/) && inCodeBlock && currentFile) {
      currentFile.content = codeBlockContent.join('\n');
      files.push(currentFile);
      currentFile = null;
      inCodeBlock = false;
      codeBlockContent = [];
      continue;
    }
    
    // Add content to current code block
    if (inCodeBlock && currentFile) {
      codeBlockContent.push(line);
    }
  }
  
  // Handle last file if still in code block
  if (currentFile && inCodeBlock) {
    currentFile.content = codeBlockContent.join('\n');
    files.push(currentFile);
  }
  
  return files.map(f => ({
    ...f,
    path: f.path.startsWith('/') ? f.path.substring(1) : f.path
  }));
}

/**
 * Validate parsed files for basic structure
 * @param {Array} files - Array of file objects
 * @returns {boolean} - True if files are valid
 */
function validateParsedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return false;
  }
  
  return files.every(file => 
    file && 
    typeof file.path === 'string' && 
    file.path.length > 0 &&
    typeof file.content === 'string'
  );
}

module.exports = { parseMarkdownResponse, validateParsedFiles };