/**
 * Zlib
 * @internal
 * @packageDocumentation
 */

import isNode from './isNode';
import { decompress as dcmpb } from './flate';

/**
 * Decompress data of an arbitrary format
 * @param dat The data to decompress
 * @returns The decompressed data
 * @internal
 */
export const decompress = isNode
  ? (dat: Uint8Array): Promise<Uint8Array> => {
      const { inflateRaw, gunzip, inflate } = require('zlib');
      return new Promise((res, rej) => {
        const cb = (err: Error, dat: Uint8Array): void => (err ? rej(err) : res(dat));
        if (dat[0] == 31 && dat[1] == 139) gunzip(dat, cb);
        else if ((dat[0] & 15) != 8 || dat[0] >> 4 > 7 || ((dat[0] << 8) | dat[1]) % 31)
          inflateRaw(dat, cb);
        else inflate(dat, cb);
      });
    }
  : dcmpb;
