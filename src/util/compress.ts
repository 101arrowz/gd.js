/**
 * Decompress level data
 * @internal
 * @packageDocumentation
 */
import isNode from './isNode';
import { gdDecodeBase64 } from './crypto';
import { decompress as dcmp } from './node-flate';

/**
 * Creates a Uint8Array from a string
 * @param dat The data to convert to a byte array
 * @returns A Uint8Array from the ASCII string
 * @internal
 */
const strToU8 = (dat: string): Uint8Array => {
  const out = new Uint8Array(dat.length);
  for (let i = 0; i < dat.length; ++i) out[i] = dat.charCodeAt(i);
  return out;
};

/**
 * Decompresses data of an arbitrary type from the Geometry Dash servers
 * @param data The Base64, compressed data to decompress
 * @returns The source string data
 * @internal
 */
const decompress = async (data: string): Promise<string> => {
  const resultBytes = await dcmp(
    isNode ? Buffer.from(data, 'base64') : strToU8(gdDecodeBase64(data))
  );
  let out = '';
  for (const byte of resultBytes) out += String.fromCharCode(byte);
  return out;
};

export { decompress };
