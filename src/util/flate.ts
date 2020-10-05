/**
 * Zlib polyfill for the browser
 * @internal
 * @packageDocumentation
 */

import { decompress as dcmp } from 'fflate';

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
