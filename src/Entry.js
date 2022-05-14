const fs = require('fs');
const path = require('path');
const { PACKING_METHODS } = require('./constants');

module.exports = class Entry {
  /** @type {string|null} */
  file = null;
  /** @type {string|null} */
  path = null;
  packing_method = PACKING_METHODS.Null;
  original_size = 0;
  reserved = 0;
  timestamp = 0;
  data_size = 0;
  data_offset = -1;
  properties = {
    prefix : null,
    product: null,
    version: null,
  };
  constructor(file = null) {
    this.setFile(file);
  }
  setFile(file) {
    if (file && fs.existsSync(file)) {
      this.file = file;
      this.path = path.dirname(file);
      const stat = fs.lstatSync(file);
      this.data_size = stat.size;
      this.timestamp = stat.mtimeMs;
      this.packing_method = PACKING_METHODS.Uncompressed;
    }
  }
  isFile() {
    return [
      PACKING_METHODS.Compressed,
      PACKING_METHODS.Encrypted,
      PACKING_METHODS.Uncompressed,
    ].includes(this.packing_method);
  }
  isVersion() {
    return this.packing_method === PACKING_METHODS.Version;
  }
  isNull() {
    return (
      (!this.path || !this.file) &&
      this.packing_method === PACKING_METHODS.Null &&
      this.original_size === 0 &&
      this.reserved === 0 &&
      this.timestamp === 0 &&
      this.data_size === 0
    );
  }
};
