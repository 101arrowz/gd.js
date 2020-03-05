/**
 * Generates a random string for use in GD requests
 * @internal
 * @packageDocumentation
 */

/**
 * Generates a random string
 * @returns A random 10-character string'
 * @internal
 */
const genRS = (): string =>
  Math.random()
    .toString(36)
    .slice(2, 12);

export { genRS };
