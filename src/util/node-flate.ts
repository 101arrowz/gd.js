/**
 * Zlib
 * @internal
 * @packageDocumentation
 */

import { inflateRaw, gunzip, inflate } from 'zlib';

/**
 * Decompress data of an arbitrary format
 * @param dat The data to decompress
 * @returns The decompressed data
 * @internal
 */
export const decompress = (dat: Uint8Array): Promise<Buffer> => {
  return new Promise((res, rej) => {
    const cb = (err: Error, dat: Buffer): void => (err ? rej(err) : res(dat));
    if (dat[0] == 31 && dat[1] == 139 && dat[2] == 8) gunzip(dat, cb);
    else if ((dat[0] & 15) != 8 || dat[0] >> 4 > 7 || ((dat[0] << 8) | dat[1]) % 31)
      inflateRaw(dat, cb);
    else inflate(dat, cb);
  });
};

/**
 * Convert a string to a Uint8Array
 * @param str The Base64 string to convert
 * @returns The buffer containing the ASCII-encoded string
 * @internal
 */
export const b64ToU8 = (str: string): Uint8Array => Buffer.from(str, 'base64');

/**
 * Convert a Uint8Array to a string
 * @param u8 The Uint8Array to convert
 * @returns The string containing the ASCII-decoded string
 * @internal
 */
export const u8ToStr = (u8: Buffer): string => u8.toString('latin1');
