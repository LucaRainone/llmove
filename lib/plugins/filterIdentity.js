/* eslint-disable */
// Identity filter plugin - returns files unchanged
/**
 *
 * @param {{specsFolder:string}} config - The content to parse
 * @param {{content: string, path:string, relativePath}[]} files - The content to parse
 * @return {Promise<*>}
 */
module.exports = async function filterIdentity(config, files) {
  return files;
};
