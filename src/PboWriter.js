const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const {
  HEADER_ENTRY_DEFAULT_SIZE,
  PACKING_METHODS,
  PACKING_BUFFER_SIZE,
} = require('./constants');
const Entry = require('./Entry');
const Header = require('./Header');

const DEFAULT_OPTIONS = {
  overrite: true,
  signed  : false,
};

module.exports = class PboWriter {
  #file = '';
  /** @type {fsp.FileHandle} */
  #handle = null;
  /** @type {Entry[]} */
  #entries = [];
  /** @type {crypto.Hash|Buffer} */
  #checksum = null;
  options = { ...DEFAULT_OPTIONS };
  constructor(file, options = { ...DEFAULT_OPTIONS }) {
    Object.assign(this.options, DEFAULT_OPTIONS, options);
    this.#file = file;
    this.#entries = [
      new Header({
        prefix : path.basename(file),
        product: path.basename(file),
        version: Date.now().toString(),
      }),
    ];
    this.#checksum = crypto.createHash('sha1');
  }

  async #writeData(value = '', nullTerminated = true) {
    if (!this.#handle) {
      return false;
    }
    let data;
    if (value instanceof Buffer) {
      data = value;
    } else if (typeof value === 'string') {
      data = Buffer.from(`${value.toString()}${nullTerminated ? '\0' : ''}`);
    } else if (typeof value === 'number') {
      const buffer = Buffer.alloc(4);
      buffer.writeUint32LE(value, 0);
      data = buffer;
    }
    if (!data) {
      return false;
    }
    await this.#handle.write(data);
    if (this.#checksum instanceof crypto.Hash) {
      this.#checksum.update(data);
    }
    return true;
  }

  /** @param {Entry|Header} entry */
  async #writeHeader(entry) {
    if (!entry) {
      return;
    }
    if (entry.isDir && !(entry instanceof Header)) {
      for (const child of entry.children) {
        await this.#writeHeader(child);
      }
      return;
    }
    await this.#writeData(
      entry.file && entry.root
        ? path.join(entry.root, path.basename(entry.file))
        : '',
    );
    await this.#writeData(entry.packing_method);
    await this.#writeData(entry.original_size);
    await this.#writeData(entry.reserved);
    await this.#writeData(entry.timestamp);
    await this.#writeData(entry.data_size);
    if (entry instanceof Header) {
      for (const [key, value] of Object.entries(entry.properties)) {
        await this.#writeData(key);
        if (!value) {
          continue;
        }
        await this.#writeData(value);
      }
      await this.#writeData('');
    }
  }

  /** @param {Entry|Header} entry */
  async #writeFile(entry) {
    if (!entry) {
      return;
    }
    if (entry.isDir && !(entry instanceof Header)) {
      for (const child of entry.children) {
        await this.#writeFile(child);
      }
      return;
    }
    const fileHandle = await fsp.open(entry.file);
    let bytesRead;
    while (bytesRead === undefined || bytesRead > 0) {
      const buffer = Buffer.alloc(PACKING_BUFFER_SIZE);
      ({ bytesRead } = await fileHandle.read(buffer));
      if (bytesRead) {
        await this.#writeData(Buffer.from(buffer, 0, bytesRead));
      }
    }
    await fileHandle.close();
  }

  async pack() {
    if (this.options.overrite && fs.existsSync(this.#file)) {
      await fsp.rm(this.#file, { force: true });
    }
    this.#handle = await fsp.open(this.#file, 'wx');

    try {
      // Write Headers
      for (const entry of this.#entries) {
        await this.#writeHeader(entry);
      }
      await this.#writeData(Buffer.alloc(HEADER_ENTRY_DEFAULT_SIZE));

      // Write Entries
      for (const entry of this.#entries) {
        switch (entry.packing_method) {
        case PACKING_METHODS.Version:
        case PACKING_METHODS.Null:
          continue;
        case PACKING_METHODS.Uncompressed: {
          this.#writeFile(entry);
          break;
        }
        default:
          throw new Error('File entry packing method unsupported!');
        }
      }
    } catch (e) {
      console.error(e);
      await this.#handle.close();
      await fsp.rm(this.#file);
      return false;
    }

    // Write Signature
    await this.#writeData('\0', false);
    this.#checksum = this.#checksum.copy().digest();
    await this.#writeData(this.#checksum, false);

    // Close FD
    await this.#handle.close();
    return true;
  }
  addFile(file) {
    if (!fs.existsSync(file)) {
      throw new Error('File does not exist!');
    }
    this.#entries.push(new Entry(file));
  }
};
