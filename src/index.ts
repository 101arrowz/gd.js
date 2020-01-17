import './polyfill';
import { isNode, GDRequestParams as GDParams, accountKey, encrypt } from './util';
import { User } from './entities';
type RawCredentials = {
  rawCreds: {
    accountID: string;
    gjp: string;
  };
};
type Config = Partial<RawCredentials> & {
  logLevel: 0 | 1 | 2;
  dbURL: string;
  corsURL: string;
  creds?: {
    username: string;
    password: string;
  };
};
type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: GDParams;
  credentials?: boolean;
};
export = class Client {
  User = User;
  private config: Config & RawCredentials;

  constructor(
    {
      logLevel = 1,
      dbURL = 'http://boomlings.com/database',
      corsURL = 'https://cors-anywhere.com/',
      creds,
      rawCreds = {
        accountID: '0',
        gjp: ''
      }
    }: Config = {} as Config
  ) {
    if (
      !(creds && creds.username && creds.password) &&
      !(rawCreds.accountID && rawCreds.accountID !== '0' && rawCreds.gjp)
    ) {
      if (logLevel > 0) console.warn('Invalid credentials provided; will not be logged in');
      creds = null;
    }
    this.config = {
      logLevel,
      dbURL,
      corsURL,
      creds,
      rawCreds
    };
    User.setClient(this);
  }

  public async req(
    url: string,
    { method = 'GET', body = null, credentials = false }: RequestConfig = {}
  ): Promise<string> {
    this.verbose(`Making a ${method} request to ${url}`);
    let sentBody = null;
    if (body) {
      if (credentials) body.insertParams(this.config.rawCreds);
      sentBody = body.resolve();
    }
    return (
      await fetch((isNode ? '' : this.config.corsURL) + this.config.dbURL + url, {
        method,
        body: sentBody
      })
    ).text();
  }

  async login(): Promise<void> {
    if (!this.config.creds) return; // No way to add new credentials
    const params = new GDParams();
    params.login(this.config.creds.username, this.config.creds.password, 'unencrypted');
    params.insertParams({
      udid: "Hi RobTop, it's gd.js!"
    });
    params.authorize('account');
    const data = await this.req('/accounts/loginGJAccount.php', {
      method: 'POST',
      body: params
    });
    // TODO: What to do with userID?
    const [accountID, userID] = data.split(',');
    const gjp = encrypt(this.config.creds.password, accountKey);
    this.config.rawCreds = {
      accountID,
      gjp
    };
    this.verbose(`Logged in with account ID ${accountID}, user ID ${userID}`);
  }

  private warn(str: string): void {
    if (this.config.logLevel > 0) console.warn(str);
  }
  private log(str: string): void {
    if (this.config.logLevel > 0) console.log(str);
  }
  private verbose(str: string): void {
    if (this.config.logLevel > 1) console.log(str);
  }
};
