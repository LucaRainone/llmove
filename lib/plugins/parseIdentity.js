/* eslint-disable */
// Identity parse plugin - returns content unchanged
/**
 *
 * @param {{specFolder:string}} config
 * @param content
 * @param file
 * @return {Promise<*>}
 */
module.exports = async function parseIdentity(config, content, file) {
  return content;
};
