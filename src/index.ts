import './polyfill';
import { isNode, GDRequestParams as GDParams, login, Credentials, UserCredentials } from './util';
import { UserFinder, User } from './entities';

/**
 * Configuration for the [GD client]{@link Client}.
 */
type Config = {
  /**
   * The level of logging. 2 = verbose, 1 = warnings, 0 = off. Defaults to 1.
   */
  logLevel: 0 | 1 | 2;
  /**
   * The URL for the database. Defaults to http://boomlings.com/database.
   */
  dbURL: string;
  /**
   * The URL to use as a CORS proxy when making requests from a browser. Defaults to https://cors-anywhere.herokuapp.com/. Note it should have a trailing slash.
   */
  corsURL: string;
  /**
   * The credentials to be used in requests.
   */
  creds: UserCredentials;
};
type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: GDParams;
  credentials?: boolean;
};

/**
 * Client for Geometry Dash requests.
 */
class Client {
  static User = User;

  /** The database of Geometry Dash users */
  users: UserFinder;

  /**
   * The configuration for the Geometry Dash client
   * @internal
   */
  private config: Config & { rawCreds: Credentials };

  /**
   * Creates a client for Geometry Dash requests.
   * @param config The configuration for the client.
   */
  constructor(
    {
      logLevel = 1,
      dbURL = 'http://boomlings.com/database',
      corsURL = 'https://cors-anywhere.com/',
      creds
    }: Config = {} as Config
  ) {
    if (!(creds && creds.username && creds.password)) {
      if (logLevel > 0) console.warn('Invalid credentials provided; will not be logged in');
      creds = null;
    }
    this.config = {
      logLevel,
      dbURL,
      corsURL,
      creds,
      rawCreds: {
        userName: '',
        accountID: '0',
        gjp: ''
      }
    };
    this.users = new UserFinder(this);
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
   * @param returnRaw Whether to parse the response or return it raw
   * @return The Response or string containing the Geometry Dash server's response
   * @internal
   */
  async req(
    url: string,
    { method = 'GET', body = null, credentials = false }: RequestConfig = {},
    returnRaw = false
  ): Promise<string | Response> {
    this.verbose(`Making a ${method} request to ${url}`);
    let sentBody = null;
    if (body) {
      sentBody = body.resolve();
    }
    if (credentials) {
      if (body) body.insertParams(this.config.rawCreds);
      else sentBody = new GDParams(this.config.rawCreds).resolve();
    }
    const resp = await fetch((isNode ? '' : this.config.corsURL) + this.config.dbURL + url, {
      method,
      body: sentBody
    });
    if (returnRaw) return resp;
    return resp.text();
  }

  /**
   * Log in to the Geometry Dash servers using the provided credentials.
   * @returns An empty promise that resolves once login is complete
   */
  async login(): Promise<void> {
    if (!this.config.creds) return; // No way to add new credentials
    this.config.rawCreds = await login(this.config.creds);
    this.verbose(
      `Logged in with account ID ${this.config.rawCreds.accountID}, username ${this.config.rawCreds.userName}`
    );
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
export = Client;
