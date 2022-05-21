const PboWriter = require('./PboWriter');
const PboReader = require('./PboReader');

const create = async (pboFile, files = [], options = {}) => {
  const writer = new PboWriter(pboFile, options);
  for (const file of files) {
    writer.addFile(file);
  }
  await writer.pack();
};

const extract = async (pboFile, dest, options = {}) => {
  const reader = new PboReader(pboFile, { ...options, dest });
  if (!await reader.unpack()) {
    return;
  }
};

module.exports = {
  PboWriter,
  create,
  extract,
};
