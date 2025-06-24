/**
 *
 * @param {{specFolder:string}} config
 * @param {{content:string}} file
 * @return {Promise<*>}
 */
module.exports = async function addNow(config, files) {
  const now = new Date();
  const newTempFile = {
    relativePath: "/tmp/root.xml",
    content: `<system><runtime_context><now unix_millis="${+now}" iso="${now.toISOString()}" offset_ts="${now.getTimezoneOffset()}"/></runtime_context></system>`
  }
  files.push(newTempFile);
  return files;
};
