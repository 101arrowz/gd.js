/**
 * Polyfilling for unsupported platforms
 * @internal
 * @packageDocumentation
 */
import isNode from './util/isNode';
if (isNode) {
  // Node.js
  if (!global.fetch) {
    try {
      global.fetch = require('node-fetch');
    } catch (e) {
      // node-fetch not installed
      throw new Error(
        'critical: gd.js cannot function without a fetch polyfill; node-fetch not installed and global.fetch not set. Please install node-fetch or set your own custom polyfill into global.fetch.'
      );
    }
  }
  global.atob = (str: string): string => Buffer.from(str, 'base64').toString();
  global.btoa = (str: string): string => Buffer.from(str).toString('base64');
  global.TextDecoder = require('util').TextDecoder;
} else if (typeof fetch === 'undefined') {
  // Old browser
  throw new Error(
    "critical: gd.js cannot function without the fetch API, and it doesn't seem \
    to exist in the current environment. Try polyfilling it with whatwg-fetch."
  );
}
