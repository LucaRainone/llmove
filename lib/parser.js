const fs = require('fs');
const path = require('path');

function extractRootMetadata(rootPath) {
  try {
    const content = fs.readFileSync(rootPath, 'utf-8');
    const metadata = {};
    
    // Extract version from system tag
    const systemMatch = content.match(/<system[^>]*>/i);
    if (systemMatch) {
      const versionMatch = systemMatch[0].match(/version=["']([^"']+)["']/i);
      if (versionMatch) {
        metadata.version = versionMatch[1];
      }
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error reading root.xml: ${error.message}`);
    return {};
  }
}

function parseContent(files) {
  let system = '';
  let prompt = '';
  
  for (const file of files) {
    const content = file.content || '';
    
    // Extract content from tags
    const systemMatch = content.match(/<system[^>]*>([\s\S]*?)<\/system>/i);
    const promptMatch = content.match(/<prompt[^>]*>([\s\S]*?)<\/prompt>/i);
    
    if (systemMatch) system += systemMatch[1].trim() + '\n';
    if (promptMatch) prompt += promptMatch[1].trim().replace(/<system[^>]*>([\s\S]*?)<\/system>/i, "") + '\n';
  }
  
  const fullSystem = system.trim();
  
  return {
    system: fullSystem,
    prompt: prompt.trim()
  };
}

module.exports = { extractRootMetadata, parseContent };
