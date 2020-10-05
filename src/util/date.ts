/**
 * Date generation for parsing GD server responses
 * @internal
 * @packageDocumentation
 */

import { Duration } from 'duration-converter';

/** A date from the Geometry Dash servers */
type GDDate = {
  /** The human-readable time in the "how long ago" format. */
  pretty: string;
  /** The time as a date. Note that this may not be completely accurate. */
  date: Date;
};

/**
 * Creates a date from the human-readable response returned by the Geometry Dash servers
 * @param pretty The pretty string to parse
 * @returns A date ready for use by a client
 * @internal
 */
const generateDate = (pretty: string): GDDate => {
  // Only on private servers will this work
  let date = new Date(pretty);
  if (!date.getTime()) date = new Date(Date.now() - new Duration(pretty).MilliSeconds);
  return { pretty, date };
};

export { GDDate, generateDate };
