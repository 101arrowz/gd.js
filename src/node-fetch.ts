/**
 * Fetch polyfill for node
 * @internal
 * @packageDocumentation
 */

/** @internal */
let fetch = (typeof window === 'undefined' ? global : window).fetch;
if (!fetch) {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    throw new Error(
      'critical: gd.js cannot function without a fetch polyfill; node-fetch not installed and no fetch polyfill was provided. Please install node-fetch to resolve the issue.'
    );
  }
}
export default fetch;
