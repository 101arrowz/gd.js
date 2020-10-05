/**
 * Encoding and decoding methods for the browser
 * @internal
 * @packageDocumentation
 */

export const gdEncodeBase64 = (str: string): string =>
  btoa(str)
    .replace(/\//g, '_')
    .replace(/\+/g, '-');

/**
 * Decode a string from Geometry Dash server-compatible Base64
 * @param str The string to decode from Geometry Dash Base64
 * @returns The original, unencoded string
 * @internal
 */
export const gdDecodeBase64 = (str: string): string =>
  atob(str.replace(/_/g, '/').replace(/-/g, '+'));
