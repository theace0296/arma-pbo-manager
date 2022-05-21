const BUFFER_MAX_LENGTH = require('buffer').constants.MAX_LENGTH;
const { NULL_TERM, UINT32_LENGTH } = require('./constants');

const convertToBuffer = (input, nullTerminated = true) => {
  let data;
  if (input instanceof Buffer) {
    data = input;
  } else if (typeof input === 'string') {
    data = nullTerminated
      ? Buffer.concat([Buffer.from(input), NULL_TERM])
      : Buffer.from(input);
  } else if (typeof input === 'number') {
    const buffer = Buffer.alloc(UINT32_LENGTH);
    buffer.writeUint32LE(input);
    if (buffer.readUint32LE() !== input) {
      throw new Error('Writing Uint32 failed!');
    }
    data = buffer;
  }
  return data;
};

/**
 * @param {import('fs/promises').FileHandle} handle
 * @param {number} start
 * @param {Buffer} match
 */
const readUntilMatch = async (handle, start = 0, match = NULL_TERM) => {
  let buffer = Buffer.alloc(BUFFER_MAX_LENGTH);
  let index = 0;
  while (index === 0 || !buffer.subarray(0, index).includes(match)) {
    const { bytesRead } = await handle.read(buffer, index, 1, start + index);
    index++;
    if (bytesRead === 0) {
      throw new Error('Error occured reading file!');
    }
  }
  buffer = buffer.subarray(0, index);
  return {
    buffer,
    index,
  };
};

/**
 * @param {import('fs/promises').FileHandle} handle
 * @param {Buffer} bufferToExtend
 * @param {number} start
 * @param {number} length
 */
const readAdditional = async (
  handle,
  bufferToExtend,
  start = 0,
  length = 0,
) => {
  if (length > 0) {
    const additionalBuffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(
      additionalBuffer,
      0,
      additionalBuffer.length,
      start,
    );
    if (bytesRead !== additionalBuffer.length || bytesRead === 0) {
      throw new Error('Error occured reading file!');
    }
    return Buffer.concat([bufferToExtend, additionalBuffer]);
  }
  return bufferToExtend;
};

module.exports = {
  convertToBuffer,
  readUntilMatch,
  readAdditional,
};
