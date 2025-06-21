const filterPlugins = [
  require('./plugins/filterAddRootConventions')
];

const parsePlugins = [
  require('./plugins/source'),
  require('./plugins/includeFiles'),
];

async function runPlugins(config, xmlFiles, rootMetadata = {}) {
  let files = [...xmlFiles];
  const processedPaths = new Set();
  const metadata = { ...rootMetadata };

  // Run filter plugins
  for (const plugin of filterPlugins) {
    files = await plugin(config, files, metadata);
  }
  // Run parse plugins recursively
  const filesToProcess = [...files];
  const processedFiles = [];
  while (filesToProcess.length > 0) {
    const file = filesToProcess.shift();

    // Skip if already processed (avoid circular dependencies)
    if (processedPaths.has(file.path)) {
      continue;
    }
    processedPaths.add(file.path);

    let currentFile = { ...file };

    // Run all parse plugins on this file
    for (const plugin of parsePlugins) {
      const result = await plugin(config, currentFile, metadata);
      // Plugin can return either a modified file or an object with file and newFiles
      if (result.file) {
        currentFile = result.file;
        // Add new files to process queue if any
        if (result.newFiles && Array.isArray(result.newFiles)) {
          filesToProcess.push(...result.newFiles);
        }
      } else {
        currentFile = result;
      }
    }

    processedFiles.push(currentFile);
  }

  return {
    files: processedFiles,
    metadata
  };
}

module.exports = { runPlugins };
