const PboWriter = require('./PboWriter');

const create = async (pboFile, files = [], options = {}) => {
  const writer = new PboWriter(pboFile, options);
  for (const file of files) {
    writer.addFile(file);
  }
  await writer.write();
};

const extract = async (path, options = {}) => {
  console.log({ path, options });
};

module.exports = {
  PboWriter,
  create,
  extract,
};