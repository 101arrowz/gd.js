/**
 * Encode a string in Geometry Dash server-compatible Base64
 * @param str The string to encode in Geometry Dash Base64
 * @returns The Geometry Dash Base64 string
 * @internal
 */
export const gdEncodeBase64 = (str: string): string =>
  Buffer.from(str, 'latin1').toString('base64');

/**
 * Decode a string from Geometry Dash server-compatible Base64
 * @param str The string to decode from Geometry Dash Base64
 * @returns The original, unencoded string
 * @internal
 */
export const gdDecodeBase64 = (str: string): string =>
  Buffer.from(str, 'base64').toString('latin1');
