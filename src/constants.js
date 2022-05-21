const PACKING_BUFFER_SIZE = 4096;
const HEADER_ENTRY_DEFAULT_SIZE = 21;

const PACKING_METHODS = {
  Uncompressed: 0x00000000,
  Compressed  : 0x43707273,
  Version     : 0x56657273,
  Encrypted   : 0x456e6372,
  Null        : 0xffffffff,
};

const EMPTY_BUFFER = Buffer.alloc(0);
const NULL_TERM = Buffer.alloc(1);
const DOUBLE_NULL_TERM = Buffer.alloc(2);
const UINT32_LENGTH = 4;

module.exports = {
  PACKING_BUFFER_SIZE,
  HEADER_ENTRY_DEFAULT_SIZE,
  PACKING_METHODS,
  EMPTY_BUFFER,
  NULL_TERM,
  DOUBLE_NULL_TERM,
  UINT32_LENGTH,
};
