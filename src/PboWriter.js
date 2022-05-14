const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { DEFAULT_OPTIONS, HEADER_ENTRY_DEFAULT_SIZE, PACKING_METHODS } = require('./constants');
const Entry = require('./Entry');

module.exports = class PboWriter {
  #file = '';
  #header = new Entry();
  /** @type {Entry[]} */
  #entries = [];
  options = { ...DEFAULT_OPTIONS };
  constructor(file, options = {}) {
    Object.assign(this.options, DEFAULT_OPTIONS, options);
    this.#file = file;
    this.#header.packing_method = PACKING_METHODS.Version;
    this.#header.properties.prefix = 'a3';
    this.#header.properties.product = path.basename(file);
    this.#header.properties.version = '';
  }
  async write() {
    if (this.options.overrite && fs.existsSync(this.#file)) {
      await fsp.rm(this.#file, { force: true });
    }
    const handle = await fsp.open(this.#file, 'wx');

    // Write Headers
    for (const [key, value] of Object.entries(this.#header)) {
      if (key) {
        await handle.write(Buffer.from(key));
      }
      if (value) {
        await handle.write(Buffer.from(value));
      }
    }
    await handle.write(Buffer.from(''));
    await handle.write(Buffer.alloc(HEADER_ENTRY_DEFAULT_SIZE));

    // Write Entries
    for (const entry of this.#entries) {
      switch (entry.packing_method) {
      case PACKING_METHODS.Uncompressed: {
        const file = await fsp.readFile(entry.file);
        await handle.write(file);
        break;
      }
      case PACKING_METHODS.Version:
      case PACKING_METHODS.Null:
        throw new Error('File entry packing method invalid!');
      default:
        throw new Error('File entry packing method unsupported!');
      }
    }

    // Write Signature
    await handle.write(Buffer.from('\0'));

    // Close FD
    await handle.close();
  }
  addFile(file) {
    if (!fs.existsSync(file)) {
      throw new Error('File does not exist!');
    }
    this.#entries.push(new Entry(file));
  }
};
