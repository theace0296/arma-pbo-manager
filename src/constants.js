const DEFAULT_OPTIONS = {
  overrite: true,
  signed  : false,
};

const PACKING_BUFFER_SIZE = 4096;
const SIGNATURE_BUFFER_SIZE = 1024;
const HEADER_ENTRY_DEFAULT_SIZE = 21;

const PACKING_METHODS = {
  Uncompressed: 0x0,
  Compressed  : 0x43707273,
  Version     : 0x56657273,
  Encrypted   : 0x456e6372,
  Null        : 0xffffffff
};

module.exports = {
  DEFAULT_OPTIONS,
  PACKING_BUFFER_SIZE,
  SIGNATURE_BUFFER_SIZE,
  HEADER_ENTRY_DEFAULT_SIZE,
  PACKING_METHODS,
};
