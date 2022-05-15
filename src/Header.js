const { PACKING_METHODS } = require('./constants');
const Entry = require('./Entry');

module.exports = class Header extends Entry {
  properties = {
    prefix : null,
    product: null,
    version: null,
  };
  constructor({ prefix, product, version }) {
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
};
