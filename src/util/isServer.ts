/**
 * Determine whether or not in a server environment
 * @internal
 * @packageDocumentation
 */

/**
 * Whether or not the current environment is a server environment
 * @internal
 */
const isServer =
  (typeof process === 'object' && Object.prototype.toString.call(process) === '[object process]') ||
  (typeof window === 'object' && 'Deno' in window);
export default isServer;
