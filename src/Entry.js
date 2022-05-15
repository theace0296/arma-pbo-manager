const fs = require('fs');
const path = require('path');

const { PACKING_METHODS } = require('./constants');

module.exports = class Entry {
  /** @type {string} */
  file = '';
  packing_method = PACKING_METHODS.Null;
  original_size = 0x0;
  reserved = 0x0;
  timestamp = 0x0;
  data_size = 0x0;
  data_offset = -1;
  isFile = false;
  isDir = false;
  children = [];
  constructor(file = null) {
    this.setFile(file);
  }
  setFile(file) {
    if (file && fs.existsSync(file)) {
      this.file = file;
      const stat = fs.lstatSync(file);
      this.data_size = stat.size;
      this.timestamp = Math.floor(stat.mtimeMs / 1000);
      if (isNaN(this.timestamp)) {
        this.timestamp = Math.floor(Date.now() / 1000);
      }
      this.packing_method = PACKING_METHODS.Uncompressed;
      this.isFile = stat.isFile();
      this.isDir = stat.isDirectory();
      if (this.isDir) {
        this.children = fs
          .readdirSync(file)
          .filter(child => !['.', '..'].includes(child))
          .map(child => new Entry(path.join(file, child)));
      }
    }
  }
  isNull() {
    return (
      this.packing_method === PACKING_METHODS.Null &&
      this.original_size === 0x0 &&
      this.reserved === 0x0 &&
      this.timestamp === 0x0 &&
      this.data_size === 0x0
    );
  }
  toString() {
    return JSON.stringify(this, null, 2);
  }
};
