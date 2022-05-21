const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const path = require('path');
const {
  HEADER_ENTRY_DEFAULT_SIZE,
  PACKING_METHODS,
  NULL_TERM,
  DOUBLE_NULL_TERM,
  EMPTY_BUFFER,
} = require('./constants');
const { readUntilMatch } = require('./utilities');
const Entry = require('./Entry');
const Header = require('./Header');

const DEFAULT_OPTIONS = {
  signed: false,
  dest  : null,
};

const readEntry = async (handle, cursor) => {
  let entry = new Entry();
  const result = await entry.readHeaderData(handle, cursor);
  if (entry.packing_method === PACKING_METHODS.Version) {
    let resultCursor = result.cursor;
    entry = Header.headerFromEntry(entry);
    const { buffer: headerBuffer } = await readUntilMatch(
      handle,
      resultCursor,
      DOUBLE_NULL_TERM,
    );
    let headerCursor = 0;
    resultCursor += headerBuffer.length;
    while (true) {
      const keyHeaderBuffer = headerBuffer.subarray(headerCursor);
      const keyIndex = keyHeaderBuffer.indexOf(NULL_TERM);
      const key = keyHeaderBuffer.subarray(0, keyIndex).toString();
      if (!key) {
        resultCursor -= headerBuffer.length - (headerCursor + 1);
        break;
      }
      headerCursor += keyIndex + 1;
      const valueHeaderBuffer = headerBuffer.subarray(headerCursor);
      const valueIndex = valueHeaderBuffer.indexOf(NULL_TERM);
      const value = valueHeaderBuffer.subarray(0, valueIndex).toString();
      headerCursor += valueIndex + 1;
      entry.properties[key] = value;
    }
    if (headerCursor > 0) {
      const buffer = Buffer.concat([result.buffer, headerBuffer]);
      return {
        ...result,
        entry,
        buffer   : buffer,
        bytesRead: buffer.length,
        cursor   : resultCursor,
      };
    } else {
      const buffer = Buffer.concat([result.buffer, Buffer.alloc(1)]);
      return {
        ...result,
        entry,
        buffer   : buffer,
        bytesRead: buffer.length,
        cursor   : resultCursor,
      };
    }
  }
  return { ...result, entry };
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
      while (true) {
        const { entry, buffer, cursor } = await readEntry(
          this.#handle,
          fileCursor,
        );
        fileCursor = cursor;
        if (this.#checksum instanceof crypto.Hash) {
          this.#checksum.update(buffer);
        }
        if (!entry.isNull()) {
          this.#entries.push(entry);
        } else {
          break;
        }
      }

      // Read Entries
      for (const entry of this.#entries) {
        switch (entry.packing_method) {
        case PACKING_METHODS.Version:
        case PACKING_METHODS.Null:
          continue;
          // case PACKING_METHODS.Compressed:
        case PACKING_METHODS.Uncompressed: {
          entry.data_offset = fileCursor;
          await entry.readData(this.#handle);
          if (this.#checksum instanceof crypto.Hash) {
            this.#checksum.update(entry.data);
          }
          if (this.options.dest && entry.file) {
            await fsp.mkdir(path.join(this.options.dest, entry.root || path.dirname(entry.file)), { recursive: true });
            const handle = await fsp.open(path.join(this.options.dest, entry.file), 'wx');
            try {
              await handle.write(entry.data);
            } catch (error) {
              console.error(error);
            }
            await handle.close();
          }
          if (this.options.dest) { // If we're extracting to a location, don't store data in memory
            entry.data = EMPTY_BUFFER;
          }
          fileCursor += entry.getOriginalSize();
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
      let { bytesRead } = await this.#handle.read(
        zeroByteBuffer,
        0,
        zeroByteBuffer.length,
        fileCursor,
      );
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
      } else if (!signatureBuffer.equals(this.#checksum)) {
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
