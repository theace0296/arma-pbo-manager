const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const { PACKING_METHODS, PACKING_BUFFER_SIZE } = require('./constants');
const { convertToBuffer } = require('./utilities');

module.exports = class Entry {
  file = '';
  root = '';
  packing_method = PACKING_METHODS.Null;
  original_size = 0x0;
  reserved = 0x0;
  timestamp = 0x0;
  data_size = 0x0;
  data_offset = -1;
  data = Buffer.alloc(0);
  isFile = false;
  isDir = false;
  children = [];
  constructor(file = null, root = '/') {
    this.setFile(file, root);
  }
  getHeaderData() {
    const buffers = [
      convertToBuffer(
        this.file && this.root
          ? path.join(this.root, path.basename(this.file))
          : '',
      ),
      convertToBuffer(this.packing_method),
      convertToBuffer(this.original_size),
      convertToBuffer(this.reserved),
      convertToBuffer(this.timestamp),
      convertToBuffer(this.data_size),
    ];
    return Buffer.concat(buffers);
  }
  async getData(callback = async () => undefined) {
    if (!this.file || !fs.existsSync(this.file)) {
      return;
    }
    const fileHandle = await fsp.open(this.file);
    const fileSize = (await fileHandle.stat()).size;
    let bytesRead;
    let totalBytesRead = 0;
    while (totalBytesRead < fileSize) {
      const buffer = Buffer.alloc(
        fileSize - totalBytesRead < PACKING_BUFFER_SIZE
          ? fileSize - totalBytesRead
          : PACKING_BUFFER_SIZE,
      );
      ({ bytesRead } = await fileHandle.read(buffer, 0, buffer.length));
      if (bytesRead) {
        await callback(buffer);
        totalBytesRead += bytesRead;
      }
    }
    await fileHandle.close();
  }
  setFile(file, root = '/') {
    if (file && fs.existsSync(file)) {
      this.file = file;
      this.root = root;
      const stat = fs.lstatSync(file);
      this.data_size = stat.size;
      this.original_size = stat.size;
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
          .map(child => new Entry(path.join(file, child), file));
      }
    }
  }
  isNull() {
    return (
      this.file.length === 0 &&
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
