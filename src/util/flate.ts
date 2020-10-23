/**
 * Zlib polyfill for the browser
 * @internal
 * @packageDocumentation
 */

import { gdDecodeBase64 } from './crypto';
import { decompress as dcmp, strToU8, strFromU8 } from 'fflate';

/**
 * Decompress data of an arbitrary format
 * @param dat The data to decompress
 * @returns The decompressed data
 * @internal
 */
export const decompress = (dat: Uint8Array): Promise<Uint8Array> =>
  new Promise((res, rej) =>
    dcmp(dat, { consume: true }, (err, dat) => (err ? rej(err) : res(dat)))
  );

/**
 * Convert a string to a Uint8Array
 * @param str The Base64 string to convert
 * @returns The buffer containing the ASCII-encoded string
 * @internal
 */
export const b64ToU8 = (str: string): Uint8Array => strToU8(gdDecodeBase64(str), true);

/**
 * Convert a Uint8Array to a string
 * @param u8 The Uint8Array to convert
 * @returns The string containing the ASCII-decoded string
 * @internal
 */
export const u8ToStr = (u8: Uint8Array): string => strFromU8(u8, true);
