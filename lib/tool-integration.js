/* eslint-disable */
const { getToolDescriptions, executeTool } = require('./tools');
const {makeSimpleApiCall} = require("./api");

/**
 * Check if the prompt requires tools and execute them
 * @param {Object} config - Configuration object
 * @param {string} system - System prompt
 * @param {string} prompt - User prompt
 * @returns {Promise<{enhancedPrompt: string, toolOutputs: Array}>} Enhanced prompt with tool outputs
 */
async function processToolRequests(config, system, prompt) {
  const toolDescriptions = getToolDescriptions();
  
  if (toolDescriptions.length === 0) {
    return { enhancedPrompt: prompt, toolOutputs: [] };
  }
  
  // Create tool analysis prompt
  const toolAnalysisPrompt = createToolAnalysisPrompt(toolDescriptions, prompt);
  
  const toolAnalysisMessages = [
    { role: 'system', content: 'You are a tool analysis assistant. Analyze the user prompt and determine if any tools should be used.' },
    { role: 'user', content: toolAnalysisPrompt }
  ];
  
  console.log('🔍 Analyzing prompt for tool usage...');
  
  try {
    const analysisResponse = await makeSimpleApiCall(config, toolAnalysisMessages);
    const toolRequests = parseToolRequests(analysisResponse);
    
    if (toolRequests.length === 0) {
      console.log('📝 No tools needed for this prompt');
      return { enhancedPrompt: prompt, toolOutputs: [] };
    }
    
    console.log(`🔧 Executing ${toolRequests.length} tool(s)...`);
    
    // Execute requested tools
    const toolOutputs = [];
    for (const request of toolRequests) {
      try {
        console.log(`  ⚙️  Executing ${request.tool} with:`, JSON.stringify(request.parameters, null, 2));
        const output = await executeTool(request.tool, request.parameters);
        toolOutputs.push({
          tool: request.tool,
          parameters: request.parameters,
          output
        });
        console.log(`  ✅ ${request.tool} completed`);
      } catch (error) {
        console.error(`  ❌ Error executing ${request.tool}:`, error.message);
        toolOutputs.push({
          tool: request.tool,
          parameters: request.parameters,
          error: error.message
        });
      }
    }
    
    // Create enhanced prompt with tool outputs
    const enhancedPrompt = createEnhancedPrompt(prompt, toolOutputs);
    
    return { enhancedPrompt, toolOutputs };
    
  } catch (error) {
    console.warn('⚠️  Tool analysis failed, proceeding without tools:', error.message);
    return { enhancedPrompt: prompt, toolOutputs: [] };
  }
}

/**
 * Create prompt for tool analysis
 * @param {Array} toolDescriptions - Available tools
 * @param {string} userPrompt - Original user prompt
 * @returns {string} Tool analysis prompt
 */
function createToolAnalysisPrompt(toolDescriptions, userPrompt) {
  const toolsJson = JSON.stringify(toolDescriptions, null, 2);
  
  return `You have access to the following tools:

${toolsJson}

User prompt: "${userPrompt}"

Analyze the user prompt and determine if any of these tools would be helpful. If tools are needed, respond with a JSON array of tool requests in this format:

[
  {
    "tool": "tool-name",
    "parameters": {
      "param1": "value1"
    }
  }
]

If no tools are needed, respond with an empty array: []

Only suggest tools that would genuinely help fulfill the user's request. Be conservative - don't use tools unless they add clear value.`;
}

/**
 * Parse tool requests from analysis response
 * @param {string} response - API response
 * @returns {Array} Array of tool requests
 */
function parseToolRequests(response) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed.filter(request => 
      request.tool && 
      typeof request.tool === 'string' && 
      request.parameters && 
      typeof request.parameters === 'object'
    );
    
  } catch (error) {
    console.warn('Failed to parse tool requests:', error.message);
    return [];
  }
}

/**
 * Create enhanced prompt with tool outputs
 * @param {string} originalPrompt - Original user prompt
 * @param {Array} toolOutputs - Tool execution results
 * @returns {string} Enhanced prompt
 */
function createEnhancedPrompt(originalPrompt, toolOutputs) {
  if (toolOutputs.length === 0) {
    return originalPrompt;
  }
  
  let enhancement = '\n\n--- Tool Outputs ---\n\n';
  
  for (const output of toolOutputs) {
    enhancement += `Tool: ${output.tool}\n`;
    enhancement += `Parameters: ${JSON.stringify(output.parameters, null, 2)}\n`;
    
    if (output.error) {
      enhancement += `Error: ${output.error}\n`;
    } else {
      enhancement += `Output: ${output.output}\n`;
    }
    
    enhancement += '\n';
  }
  
  enhancement += '--- End Tool Outputs ---\n\n';
  enhancement += 'Please use the above tool outputs to help fulfill the following request:\n\n';
  
  return originalPrompt + enhancement;
}


module.exports = {
  processToolRequests,
  createToolAnalysisPrompt,
  parseToolRequests,
  createEnhancedPrompt
};
