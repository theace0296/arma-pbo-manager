const fsp = require('fs/promises');
const path = require('path');

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
  const reader = new PboReader(pboFile, options);
  if (!await reader.unpack()) {
    return;
  }
  for (const entry of reader.getEntries()) {
    if (entry.file && entry.root) {
      await fsp.mkdir(path.join(dest, entry.root), { recursive: true });
      const handle = await fsp.open(path.join(dest, entry.file), 'wx');
      try {
        await handle.write(entry.data);
      } catch (error) {
        console.error(error);
      }
      await handle.close();
    }
  }
};

module.exports = {
  PboWriter,
  create,
  extract,
};
