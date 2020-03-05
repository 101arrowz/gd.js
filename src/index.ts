import './polyfill';
import { isNode, GDRequestParams as GDParams } from './util';
import { UserCreator, LevelCreator } from './entities';

/**
 * Configuration for the GD Client
 */
type Config = {
  /** The level of logging. 2 = verbose, 1 = warnings, 0 = off. Defaults to 1. */
  logLevel: 0 | 1 | 2;
  /** The URL for the database. Defaults to http://boomlings.com/database. */
  dbURL: string;
  /** The URL to use as a CORS proxy when making requests from a browser. Defaults to https://cors-anywhere.herokuapp.com/. Note it should have a trailing slash. */
  corsURL: string;
};

/**
 * Configuration for a request to the GD servers
 */
type RequestConfig = {
  /** The method for the request */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** The parameters for the request */
  body?: GDParams;
};

/** @internal */
const DEFAULT_CONFIG: Config = {
  logLevel: 1,
  dbURL: 'http://boomlings.com/database',
  corsURL: 'https://cors-anywhere.herokuapp.com/'
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
  constructor(config?: Partial<Config>) {
    this.config = config
      ? DEFAULT_CONFIG
      : {
          ...DEFAULT_CONFIG,
          ...config
        };
    this.users = new UserCreator(this);
    this.levels = new LevelCreator(this);
  }

  /** @internal */
  async req(url: string, conf: RequestConfig, returnRaw: true): Promise<Response>;
  /** @internal */
  async req(url: string, conf: RequestConfig, returnRaw?: false): Promise<string>;
  /**
   * Make a request to a Geometry Dash server.
   *
   * @param url The path to request to (based at the {@link Config.dbURL})
   * @param conf The request configuration
   * @param returnRaw Whether to parse the response into a string or return it raw
   * @return The Response or string containing the Geometry Dash server's response
   * @internal
   */
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
      (isNode ? '' : this.config.corsURL) + (url.startsWith('http') ? '' : this.config.dbURL) + url,
      {
        method,
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
export default Client;
