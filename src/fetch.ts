/**
 * Fetch check for the browser
 * @internal
 * @packageDocumentation
 */

if (typeof fetch === 'undefined')
  throw new Error(
    "critical: gd.js cannot function without the fetch API, and it doesn't seem to exist in the current environment. Try polyfilling it with whatwg-fetch."
  );
export default fetch;
