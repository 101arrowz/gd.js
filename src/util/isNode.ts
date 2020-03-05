/**
 * Determine whether or not in Node.js
 * @internal
 * @packageDocumentation
 */

/**
 * Whether or not the current environment is Node.js
 * @internal
 */
const isNode =
  typeof process === 'object' && Object.prototype.toString.call(process) === '[object process]';
export default isNode;
