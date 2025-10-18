/* eslint-disable */
const fs = require('fs');
const path = require('path');

/**
 * Load all available tools from the tools directory
 * @returns {Object} Object with tool names as keys and tool functions as values
 */
function loadTools() {
  const toolsDir = __dirname;
  const tools = {};
  
  const files = fs.readdirSync(toolsDir);
  
  for (const file of files) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    
    const toolName = path.basename(file, '.js');
    const toolPath = path.join(toolsDir, file);
    
    try {
      tools[toolName] = require(toolPath);
    } catch (error) {
      console.warn(`Failed to load tool ${toolName}:`, error.message);
    }
  }
  
  return tools;
}

/**
 * Get tool descriptions for LLM
 * @returns {Array} Array of tool descriptions
 */
function getToolDescriptions() {
  const tools = loadTools();
  const descriptions = [];
  
  for (const [name, tool] of Object.entries(tools)) {
    if (tool.description) {
      descriptions.push({
        name,
        description: tool.description,
        parameters: tool.parameters || {}
      });
    }
  }
  
  return descriptions;
}

/**
 * Execute a tool by name with given parameters
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} parameters - Parameters to pass to the tool
 * @returns {Promise<any>} Tool execution result
 */
async function executeTool(toolName, parameters) {
  const tools = loadTools();
  const tool = tools[toolName];
  
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }
  
  return await tool.execute(parameters);
}

module.exports = {
  loadTools,
  getToolDescriptions,
  executeTool
};