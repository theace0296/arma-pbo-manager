const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const BUFFER_MAX_LENGTH = require('buffer').constants.MAX_LENGTH;
const { HEADER_ENTRY_DEFAULT_SIZE, PACKING_METHODS } = require('./constants');
const Entry = require('./Entry');
const Header = require('./Header');

const DEFAULT_OPTIONS = {
  signed: false,
};

module.exports = class PboReader {
  #file = '';
  /** @type {fsp.FileHandle} */
  #handle = null;
  /** @type {Entry[]} */
  #entries = [];
  /** @type {crypto.Hash|Buffer} */
  #checksum = null;
  options = { ...DEFAULT_OPTIONS };
  constructor(file, options = { ...DEFAULT_OPTIONS }) {
    Object.assign(this.options, DEFAULT_OPTIONS, options);
    this.#file = file;
    this.#entries = [];
    this.#checksum = crypto.createHash('sha1');
  }

  async unpack() {
    if (!fs.existsSync(this.#file)) {
      throw new Error('File doesn\'t exist!');
    }
    this.#handle = await fsp.open(this.#file);
    const fileSize = (await this.#handle.stat()).size;

    try {
      // Keep track of the read position
      let fileCursor = 0;

      // Read Headers
      let bytesRead;
      while (bytesRead === undefined || bytesRead > 0) {
        const buffer = Buffer.alloc(HEADER_ENTRY_DEFAULT_SIZE);
        ({ bytesRead } = await this.#handle.read(buffer, 0, buffer.length, fileCursor));
        if (bytesRead === HEADER_ENTRY_DEFAULT_SIZE) {
          let cursor = 0;
          const index = buffer.indexOf(0x0);
          const fileBuffer = buffer.subarray(cursor, index);
          const file = fileBuffer.toString();
          fileCursor += index + 1;
          const fullBuffer = await (async () => {
            if (file) {
              const additionalBuffer = Buffer.alloc(fileBuffer.length);
              const { bytesRead } = await this.#handle.read(
                additionalBuffer,
                0,
                additionalBuffer.length,
                fileCursor,
              );
              if (bytesRead !== additionalBuffer.length || bytesRead === 0) {
                throw new Error('Error occured reading file!');
              }
              return Buffer.concat([buffer, additionalBuffer]);
            }
            return buffer;
          })();
          cursor += index + 1;
          const packing_method = fullBuffer.readUint32LE(cursor);
          fileCursor += 4;
          cursor += 4;
          const original_size = fullBuffer.readUint32LE(cursor);
          fileCursor += 4;
          cursor += 4;
          const reserved = fullBuffer.readUint32LE(cursor);
          fileCursor += 4;
          cursor += 4;
          const timestamp = fullBuffer.readUint32LE(cursor);
          fileCursor += 4;
          cursor += 4;
          const data_size = fullBuffer.readUint32LE(cursor);
          fileCursor += 4;
          cursor += 4;

          if (this.#checksum instanceof crypto.Hash) {
            this.#checksum.update(fullBuffer);
          }

          const entry =
            packing_method === PACKING_METHODS.Version
              ? new Header()
              : new Entry();
          entry.file = file;
          entry.root = file ? path.dirname(file) : '';
          entry.packing_method = packing_method;
          entry.original_size = original_size;
          entry.reserved = reserved;
          entry.timestamp = timestamp;
          entry.data_size = data_size;
          if (entry instanceof Header) {
            const endOfHeader = Buffer.alloc(2);
            let headerBuffer = Buffer.alloc(BUFFER_MAX_LENGTH);
            let index = 0;
            while (
              index === 0 ||
              !headerBuffer.subarray(0, index).includes(endOfHeader)
            ) {
              const { bytesRead } = await this.#handle.read(
                headerBuffer,
                index,
                1,
                fileCursor + index,
              );
              index++;
              if (bytesRead === 0) {
                throw new Error('Error occured reading file!');
              }
            }
            headerBuffer = headerBuffer.subarray(0, index);
            let headerCursor = 0;
            fileCursor += headerBuffer.length;
            while (true) {
              const keyHeaderBuffer = headerBuffer.subarray(headerCursor);
              const keyIndex = keyHeaderBuffer.indexOf(0x0);
              const key = keyHeaderBuffer.subarray(0, keyIndex).toString();
              if (!key) {
                fileCursor -= headerBuffer.length - (headerCursor + 1);
                break;
              }
              headerCursor += keyIndex + 1;
              const valueHeaderBuffer = headerBuffer.subarray(headerCursor);
              const valueIndex = valueHeaderBuffer.indexOf(0x0);
              const value = valueHeaderBuffer
                .subarray(0, valueIndex)
                .toString();
              headerCursor += valueIndex + 1;
              entry.properties[key] = value;
            }
            if (this.#checksum instanceof crypto.Hash && headerCursor > 0) {
              this.#checksum.update(headerBuffer);
            }
          }
          if (!entry.isNull() || entry instanceof Header) {
            this.#entries.push(entry);
          } else {
            break;
          }
        } else if (bytesRead === 0 && this.#entries.length === 0) {
          throw new Error('Null entry not found!');
        } else if (bytesRead === 0) {
          throw new Error('Error occured reading file!');
        } else {
          throw new Error('Header entry size too small!');
        }
      }

      // Read Entries
      for (const entry of this.#entries) {
        switch (entry.packing_method) {
        case PACKING_METHODS.Version:
        case PACKING_METHODS.Null:
          continue;
        case PACKING_METHODS.Uncompressed: {
          entry.data_offset = fileCursor;
          const buffer = Buffer.alloc(entry.data_size);
          ({ bytesRead } = await this.#handle.read(buffer, 0, buffer.length, fileCursor));
          if (bytesRead !== entry.data_size) {
            throw new Error('Data entry size did not match!');
          }
          if (this.#checksum instanceof crypto.Hash) {
            this.#checksum.update(buffer);
          }
          entry.data = buffer;
          fileCursor += entry.data_size;
          break;
        }
        default:
          throw new Error('File entry packing method unsupported!');
        }
      }

      // Read Signature
      if (fileSize - fileCursor !== HEADER_ENTRY_DEFAULT_SIZE) {
        throw new Error('Signature not found!');
      }
      const zeroByteBuffer = Buffer.alloc(1);
      ({ bytesRead } = await this.#handle.read(
        zeroByteBuffer,
        0,
        zeroByteBuffer.length,
        fileCursor,
      ));
      fileCursor += 1;
      if (this.#checksum instanceof crypto.Hash) {
        this.#checksum.update(zeroByteBuffer);
      }

      const signatureBuffer = Buffer.alloc(HEADER_ENTRY_DEFAULT_SIZE - 1);
      ({ bytesRead } = await this.#handle.read(
        signatureBuffer,
        0,
        signatureBuffer.length,
        fileCursor,
      ));
      if (bytesRead !== HEADER_ENTRY_DEFAULT_SIZE - 1) {
        throw new Error('Signature size invalid!');
      }
      this.#checksum = this.#checksum.copy().digest();
      if (!signatureBuffer.equals(this.#checksum) && this.options.signed) {
        throw new Error('Signature did not match data!');
      } else if (signatureBuffer.equals(this.#checksum)) {
        console.warn('Signature did not match data!');
      }
    } catch (e) {
      console.error(e);
      await this.#handle.close();
      return false;
    }

    // Close FD
    await this.#handle.close();
    return true;
  }

  getEntries() {
    return this.#entries;
  }
};
