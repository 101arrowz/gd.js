/**
 * Generates a random string
 * @returns A random 10-character string
 */
const genRS = (): string =>
  Math.random()
    .toString(36)
    .slice(2, 12);

export { genRS };
