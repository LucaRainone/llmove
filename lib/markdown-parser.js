/* eslint-disable */

/**
 * Parse markdown response and extract file definitions
 * @param {string} markdownContent - Raw markdown response from LLM
 * @returns {{files:Array<{path: string, content: string}>, notes:string}} - Array of file objects
 */
function parseMarkdownResponse(markdownContent) {
  const rows = markdownContent.split('\n');
  const files = {};
  let searchFileCode = true;
  let fetchContent = false;
  let currentFilename = "";
  let currentContentRows = []
  let notes = [];

  mainloop:
   for(let i = 0; i < rows.length; i++) {
     const line = rows[i];
     if(searchFileCode) {
       const match = line.match(/^## File: (.*?)$/);
       if(match) {
         for(let j = i+1; j<rows.length; j++) {
           if(rows[j].match(/^`{3}[^ ]*$/)) {
             searchFileCode = false;
             currentFilename = match[1];
             fetchContent = true;
             i=j;
             continue mainloop;
           }
         }
       }
     }
     if(fetchContent) {
       const match = line.match(/^`{3}$/);
       if (match) {
         fetchContent = false;
         searchFileCode = true;
         files[currentFilename] = currentContentRows.join("\n");
         currentContentRows = [];
         continue;
       }
       currentContentRows.push(line);
       continue ;
     }
     if( line !== "# Generated Files")
       notes.push(line);
   }


  return {
    files: Object.entries(files).map(([file,content])=> {
      return {
        path: file.startsWith('/')? file.substring(1) : file,
        content
      }
    }),
    notes: notes.filter(a=>a.trim()).join("\n").trim()
  };
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
