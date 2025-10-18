/* eslint-disable */
const fs = require('fs');
const readline = require("readline");
const {question} = require("../utils");

/**
 * Recursively get all files in given directories
 * @param {Object} parameters - Tool parameters
 * @param {Array<string>} parameters.files - Array of directory paths
 * @returns {Promise<{path:string, content:string}[]>} Array of file objects with path and relative path
 */
async function execute({ files }) {
  if (!Array.isArray(files)) {
    throw new Error('dirs parameter must be an array');
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const allFiles = [];
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`File does not exist: ${file}`);
      continue;
    }
    const answer = await question(rl, `cloud LLM wants access to file ${file}. Do you want to grant it?`)
    if(answer === "y" || answer === "yes") {
      const fileContent = fs.readFileSync(file)
      allFiles.push({path: file, content: fileContent});
    }else {
      console.log(`Access to file ${file} denied!`)
    }
  }
  rl.close();
  return allFiles.map(({path,content})=> {
    return `<code path="${path}">
${content}
</code>`
  }).join("\n\n");
}

// Tool metadata for MCP registration
execute.description = "Retrieve the full contents of one or more specified files.";
execute.parameters = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "string"
      },
      description: "List of file paths to retrieve. Each entry must be a valid path to an accessible file."
    }
  },
  required: ["files"]
};


module.exports = {
  execute,
  description: execute.description,
  parameters: execute.parameters
};
