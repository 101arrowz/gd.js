/**
 * Parse the data from the server
 * @internal
 * @packageDocumentation
 */

/**
 * A parsed response from the Geometry Dash servers
 */
export type ParsedData = { [k: string]: string };

/**
 * Converts the raw string response from a Geometry Dash server into key-value pairs.
 * @param data The data to parse
 * @param splitter The splitter for the data. Defaults to a colon
 * @returns The parsed data
 * @internal
 */
export const parse = (data: string, splitter = ':'): ParsedData => {
  const split = data.split(splitter);
  const obj: ParsedData = {};
  for (let i = 0; i < split.length; i += 2) obj[split[i]] = split[i + 1];
  return obj;
};

/**
 * A parsed Geometry Dash level object
 */
export type ParsedLevelData = { [k: number]: number };

/**
 * Converts a raw object string into a JavaScript object.
 * @param data The object to parse
 * @returns The parsed object
 * @internal
 */
export const parseObject = (data: string): ParsedLevelData => {
  const split = data.split(',');
  const obj: ParsedLevelData = {};
  // the majority
  for (let i = 0; i < split.length; i += 2) obj[split[i]] = +split[i + 1] || split[i + 1];
  return obj;
};
