const PACKING_BUFFER_SIZE = 4096;
const HEADER_ENTRY_DEFAULT_SIZE = 21;

const PACKING_METHODS = {
  Uncompressed: 0x00000000,
  Compressed  : 0x43707273,
  Version     : 0x56657273,
  Encrypted   : 0x456e6372,
  Null        : 0xffffffff,
};

module.exports = {
  PACKING_BUFFER_SIZE,
  HEADER_ENTRY_DEFAULT_SIZE,
  PACKING_METHODS,
};
