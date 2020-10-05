/**
 * Request parameter generator
 * @internal
 * @packageDocumentation
 */

/** @internal */
const USP =
  typeof URLSearchParams === 'undefined'
    ? (require('url').URLSearchParams as typeof URLSearchParams)
    : URLSearchParams;

/**
 * The "secrets" used to authenticate with Geometry Dash servers
 * @remarks Only exist because RobTop doesn't know how to use tokens.
 * @internal
 */
const SECRETS = {
  db: 'Wmfd2893gb7',
  account: 'Wmfv3899gc9',
  moderator: 'Wmfp3879gc3'
};

/**
 * Parsed data returned from Geometry Dash requests
 * @internal
 */
export type GDRequestData = { [k: string]: string | number };

/**
 * Parameters for Geometry Dash requests
 * @internal
 */
export default class GDRequestParams {
  private data: GDRequestData;

  /**
   * Creates a new group of Geometry Dash request parameters.
   * @param data The key-value pairs to insert
   */
  constructor(data: GDRequestData = {}) {
    this.data = {
      gdw: 0,
      gameVersion: 21,
      binaryVersion: 35,
      ...data
    };
  }

  /**
   * Inserts new parameters into the request parameter list.
   * @param data The key-value pairs to insert
   * @returns The new raw data
   */
  insertParams(data: GDRequestData): GDRequestData {
    return Object.assign(this.data, data);
  }

  /**
   * Authorizes the parameters for a certain type of request.
   * @param type The type of request to authenticate for
   * @returns The new raw data
   */
  authorize(type: keyof typeof SECRETS = 'db'): GDRequestData {
    this.data.secret = SECRETS[type];
    return this.data;
  }

  /**
   * Resolves the request parameters to a URLSearchParams object.
   * @returns The parameters as a URLSearchParams object
   */
  resolve(): URLSearchParams {
    return new USP(
      Object.keys(this.data).map(paramName => [paramName, this.data[paramName].toString()])
    );
  }
}
