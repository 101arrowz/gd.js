/**
 * A parsed response from the Geometry Dash servers
 */
export type ParsedData = { [k: string]: string };
/**
 * Converts the raw string response from a Geometry Dash server into key-value pairs.
 * @param data The data to parse
 * @param splitter The splitter for the data. Defaults to a colon
 * @returns The parsed data
 */
export const parse = (data: string, splitter = ':'): ParsedData => {
  const split = data.split(splitter);
  const obj: ParsedData = {};
  for (let i = 0; i < split.length; i += 2) {
    obj[split[i]] = split[i + 1];
  }
  return obj;
};
