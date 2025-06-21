/**
 * Plugin to transform <llmove:source> tags into <code><llmove:include> format
 * 
 * This parser plugin replaces all <llmove:source path="{path}" /> tags that appear
 * at the beginning of a line (ignoring leading spaces) with the format:
 * <code path="{path}"><llmove:include path="{path}" /></code>
 */

/**
 * Transform source tags to include format
 * @param {{specsFolder:string}} config - The content to parse
 * @param {{content: string, path:string, relativePath}} file - The content to parse
 * @returns The transformed content
 */
function source(config, file) {
  // Regular expression to match <llmove:source path="..." /> at line start (with optional spaces)
  // Captures the path value for reuse
  const sourceTagRegex = /^(\s*)<llmove:source\s+path="([^"]+)"\s*\/>/gm;
  
  // Replace each match with the new format
  file.content =  file.content.replace(sourceTagRegex, (match, spaces, path) => {
    return `${spaces}<code path="${path}">
   <llmove:include path="${path}" />
</code>`;
  });
  return file;
}

// Export the plugin
module.exports = source;
