/**
 *
 * @param {{specFolder:string}} config
 * @param {{content:string}} file
 * @return {Promise<*>}
 */
module.exports = async function addNow(config, file) {
  const now = new Date();
   file.content+= `\n<system><runtime_context><now unix_millis="${+now}" iso="${now.toISOString()}" offset_ts="${now.getTimezoneOffset()}"/></runtime_context></system>`;
   return file;
};
