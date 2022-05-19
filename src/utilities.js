const convertToBuffer = (input, nullTerminated = true) => {
  let data;
  if (input instanceof Buffer) {
    data = input;
  } else if (typeof input === 'string') {
    data = nullTerminated
      ? Buffer.concat([Buffer.from(input), Buffer.alloc(1)])
      : Buffer.from(input);
  } else if (typeof input === 'number') {
    const buffer = Buffer.alloc(4);
    buffer.writeUint32LE(input);
    data = buffer;
  }
  return data;
};

module.exports = {
  convertToBuffer,
};
