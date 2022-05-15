const fs = require('fs');

const DEFAULT_OPTIONS = {
  signed: false,
};

module.exports = class PboReader {
  #file = '';
  options = { ...DEFAULT_OPTIONS };
  constructor(file, options = { ...DEFAULT_OPTIONS }) {
    Object.assign(this.options, DEFAULT_OPTIONS, options);
    this.#file = file;
  }

  async unpack() {
    if (!fs.existsSync(this.#file)) {
      throw new Error('File doesn\'t exist!');
    }
  }
};
