const { PACKING_METHODS } = require('./constants');
const { convertToBuffer } = require('./utilities');
const Entry = require('./Entry');

module.exports = class Header extends Entry {
  properties = {
    prefix : null,
    product: null,
    version: null,
  };
  constructor({ prefix, product, version } = {}) {
    super();
    this.packing_method = PACKING_METHODS.Version;
    if (prefix) {
      this.properties.prefix = prefix;
    }
    if (product) {
      this.properties.product = product;
    }
    if (version) {
      this.properties.version = version;
    }
  }
  getHeaderData() {
    const buffers = [
      super.getHeaderData(),
      ...Object.entries(this.properties).reduce((acc, [key, value]) => {
        acc = [...acc, convertToBuffer(key)];
        if (value === undefined || value === null) {
          return acc;
        }
        return [...acc, convertToBuffer(value)];
      }, []),
      Buffer.alloc(1),
    ];
    return Buffer.concat(buffers);
  }
};
