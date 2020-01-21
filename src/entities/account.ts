import {
  Credentials,
  UserCredentials,
  GDRequestParams,
  accountKey,
  encrypt,
  ParsedData,
  parse
} from '../util';
import Creator from './entityCreator';
import { User } from './user';

/** A date from the Geometry Dash servers */
type GDDate = {
  /** The human-readable response, as returned by the Geometry Dash servers */
  pretty: string;
  /** The time as a date. Note that this may not be completely accurate. Will only be present if the `ms` module is installed */
  date?: Date;
};

/**
 * Creates a date from the human-readable response returned by Geometry Dash servers
 * @returns A date ready for use in the Comment class
 */
let generateDate = (pretty: string): GDDate => ({
  pretty
});
try {
  const ms = require('ms');
  generateDate = (pretty: string): GDDate => ({
    pretty,
    date: new Date(Date.now() - ms(pretty))
  });
} catch (e) {}

/**
 * A comment made by a Geometry Dash player
 */
abstract class Comment {
  /** The text in the comment */
  text: string;
  /** The time when the comment was created */
  createdAt: GDDate;
  /** The ID of the comment */
  id: number;
  /** The likes on the number */
  likes: number;
  /** Whether or not the comment has been marked as spam */
  isSpam: boolean;

  /**
   * Creates a comment from a server response
   * @param data The parsed data for the comment
   */
  constructor(data: ParsedData) {
    this.text = atob(data[2]);
    this.createdAt = generateDate(data[9]);
    this.id = +data[6];
    this.likes = +data[4];
    this.isSpam = !!+data[7];
  }
}

class AccountComment extends Comment {
  constructor(
    /** @internal */
    private _account: Account,
    rawData: string
  ) {
    super(parse(rawData, '~'));
  }
}

/**
 * A Geometry Dash player's account
 */
class Account {
  /**
   * Create info about a player's account.
   */
  constructor(
    /** @internal */
    private _creator: AccountCreator,
    /** @internal */
    private _creds: Credentials
  ) {}

  /**
   * Get comments posted to this account's page
   * @param num The maximum number of results to fetch. If not specified, a single comment (the most recent one) is returned rather than an array.
   * @returns A comment or an array of comments
   * @async
   */
  async getComments(): Promise<AccountComment>;
  async getComments(num: number): Promise<AccountComment[]>;
  async getComments(num?: number): Promise<AccountComment | AccountComment[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const numToGet = Math.ceil(num / 10);
    const searchedUsers: AccountComment[] = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        ...this._creds,
        page,
        total: 0
      });
      params.authorize('db');
      const data = await this._creator._client.req('/getGJAccountComments20.php', {
        method: 'POST',
        body: params
      });
      if (data === '-1') return singleReturn ? null : [];
      const split = data.slice(0, data.indexOf('#')).split('|');
      searchedUsers.push(...split.map(str => new AccountComment(this, str)));
      if (split.length < 10) break;
    }
    return singleReturn ? searchedUsers[0] || null : searchedUsers.slice(0, num);
  }

  /**
   * Post a comment to this account's page
   * @param msg The message to post
   * @returns An empty promise that resolves when the message is posted
   * @async
   */
  async postComment(msg: string, returnComment: true): Promise<AccountComment>;
  async postComment(msg: string, returnComment?: false): Promise<void>;
  async postComment(msg: string, returnComment = false): Promise<void | AccountComment> {
    const comment = btoa(msg);
    const params = new GDRequestParams({
      ...this._creds,
      comment,
      cType: 0
    });
    params.authorize('db');
    await this._creator._client.req('/uploadGJAccComment20.php', {
      method: 'POST',
      body: params
    });
    if (returnComment) return await this.getComments();
  }

  /**
   * Gets the user profile associated with this account.
   * @returns The user whose account ID matches this account's ID
   * @async
   */
  async getUser(): Promise<User> {
    return await this._creator._client.users.getByAccountID(this._creds.accountID);
  }
}

/**
 * A creator for Geometry Dash accounts
 */
class AccountCreator extends Creator {
  /**
   * Log in to a Geometry Dash account
   * @param userCreds The username and password to log in with
   * @throws {TypeError} Credentials must be valid
   * @async
   */
  async login(userCreds: UserCredentials): Promise<Account> {
    const params = new GDRequestParams();
    params.insertParams({
      userName: userCreds.username,
      password: userCreds.password,
      udid: "Hi RobTop, it's gd.js!"
    });
    params.authorize('account');
    const data = await this._client.req('/accounts/loginGJAccount.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') throw new TypeError('could not log in because the credentials were invalid');
    // TODO: What to do with userID (index 1)?
    const [accountIDStr] = data.split(',');
    const gjp = encrypt(userCreds.password, accountKey);
    return new Account(this, {
      userName: userCreds.username,
      accountID: +accountIDStr,
      gjp
    });
  }
}

export { Account, AccountCreator };
