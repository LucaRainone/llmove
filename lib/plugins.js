/* eslint-disable */
const filterPlugins = [
  require('./plugins/filterIdentity')
];

const parsePlugins = [
  require('./plugins/parseIdentity')
];

async function runPlugins(xmlFiles) {
  let files = [...xmlFiles];
  
  // Run filter plugins
  for (const plugin of filterPlugins) {
    files = await plugin(files);
  }
  
  // Extract system, context, and prompt content
  let system = '';
  let context = '';
  let prompt = '';
  
  for (const file of files) {
    let content = file.content;
    
    // Run parse plugins on content
    for (const plugin of parsePlugins) {
      content = await plugin(content, file);
    }
    
    // Simple extraction based on tags
    const systemMatch = content.match(/<system[^>]*>([\s\S]*?)<\/system>/i);
    const contextMatch = content.match(/<context[^>]*>([\s\S]*?)<\/context>/i);
    const promptMatch = content.match(/<prompt[^>]*>([\s\S]*?)<\/prompt>/i);
    
    if (systemMatch) system += systemMatch[1].trim() + '\n';
    if (contextMatch) context += contextMatch[1].trim() + '\n';
    if (promptMatch) prompt += promptMatch[1].trim() + '\n';
  }
  
  const fullSystem = (system + '\n' + context).trim();
  
  return {
    files,
    system: fullSystem,
    prompt: prompt.trim()
  };
}

module.exports = { runPlugins };