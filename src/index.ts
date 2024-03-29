import { isServer, GDRequestParams } from './util';
import { UserCreator, LevelCreator } from './entities';
import fetch from './node-fetch';

/**
 * Configuration for the GD Client
 */
type Config = {
  /** The level of logging. 2 = verbose, 1 = warnings, 0 = off. Defaults to 1. */
  logLevel?: 0 | 1 | 2;
  /** The URL for the database. Defaults to http://www.boomlings.com/database. */
  dbURL?: string;
  /** The URL to use as a CORS proxy when making requests from a browser. Note it should have a trailing slash. */
  corsURL?: string;
  /** The fetch polyfill to use. Only necessary when fetch is not supported in the target environment. Defaults to node-fetch (if installed) */
  fetch?: typeof fetch;
};

/**
 * Configuration for a request to the GD servers
 */
type RequestConfig = {
  /** The method for the request */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** The parameters for the request */
  body?: GDRequestParams;
};

/** @internal */
const DEFAULT_CONFIG: Config = {
  logLevel: 1,
  dbURL: 'http://www.boomlings.com/database',
  fetch
};

/**
 * Client for Geometry Dash requests.
 */
class Client {
  /** The database of Geometry Dash users */
  users: UserCreator;
  /** The database of Geometry Dash levels */
  levels: LevelCreator;

  /**
   * The configuration for the Geometry Dash client
   * @internal
   */
  private config: Config;

  /**
   * Creates a client for Geometry Dash requests.
   * @param config The configuration for the client.
   */
  constructor(config?: Config) {
    if (!isServer && !config.corsURL) {
      throw new Error(
        'critical: gd.js cannot function in the browser without a CORS proxy. Please provide a corsURL in the options to fix this issue.'
      );
    }
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    this.users = new UserCreator(this);
    this.levels = new LevelCreator(this);
  }

  /**
   * Make a request to a Geometry Dash server. It isn't recommended to use this directly, but if there's
   * some section of the Geometry Dash server API that `gd.js` doesn't provide, this is a good solution.
   *
   * @param url The path to request to (based at the {@link Config.dbURL})
   * @param conf The request configuration
   * @param returnRaw Whether to parse the response into a string or return it raw
   * @return The Response containing the Geometry Dash server's response
   */
  async req(url: string, conf: RequestConfig, returnRaw: true): Promise<Response>;
  /**
   * Make a request to a Geometry Dash server.
   *
   * @param url The path to request to (based at the {@link Config.dbURL})
   * @param conf The request configuration
   * @param returnRaw Whether to parse the response into a string or return it raw
   * @return The string containing the Geometry Dash server's response
   */
  async req(url: string, conf: RequestConfig, returnRaw?: false): Promise<string>;
  async req(
    url: string,
    { method = 'GET', body = null }: RequestConfig = {},
    returnRaw = false
  ): Promise<string | Response> {
    let sentBody = null;
    if (body) {
      sentBody = body.resolve();
    }
    const resp = await fetch(
      (isServer ? '' : this.config.corsURL) +
        (url.startsWith('http') ? '' : this.config.dbURL) +
        url,
      {
        method,
        headers: { 'User-Agent': '' },
        referrerPolicy: 'no-referrer',
        body: sentBody
      }
    );
    if (returnRaw) return resp;
    const data = await resp.text();
    this.verbose(`Made a ${method} request to ${url}, response: ${data}`);
    return data;
  }

  /** @internal */
  private warn(str: string): void {
    if (this.config.logLevel > 0) console.warn(str);
  }

  /** @internal */
  private log(str: string): void {
    if (this.config.logLevel > 0) console.log(str);
  }

  /** @internal */
  private verbose(str: string): void {
    if (this.config.logLevel > 1) console.log(str);
  }
}

export { Config, RequestConfig, GDRequestParams };
export * from './entities';
export default Client;
