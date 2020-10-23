/**
 * Decompress level data
 * @internal
 * @packageDocumentation
 */
import { decompress as dcmp, b64ToU8, u8ToStr } from './flate';

/**
 * Decompresses data of an arbitrary type from the Geometry Dash servers
 * @param data The Base64, compressed data to decompress
 * @returns The source string data
 * @internal
 */
const decompress = (data: string): Promise<string> => dcmp(b64ToU8(data)).then(u8ToStr);

export { decompress };
