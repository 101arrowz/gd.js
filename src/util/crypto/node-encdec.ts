import isNode from '../isNode';
import { gdEncodeBase64 as e, gdDecodeBase64 as d } from './encdec';

/**
 * Encode a string in Geometry Dash server-compatible Base64
 * @param str The string to encode in Geometry Dash Base64
 * @returns The Geometry Dash Base64 string
 * @internal
 */
export const gdEncodeBase64 = isNode
  ? (str: string): string => Buffer.from(str).toString('base64')
  : e;

/**
 * Decode a string from Geometry Dash server-compatible Base64
 * @param str The string to decode from Geometry Dash Base64
 * @returns The original, unencoded string
 * @internal
 */
export const gdDecodeBase64 = isNode
  ? (str: string): string => Buffer.from(str, 'base64').toString()
  : d;
