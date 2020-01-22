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
import { User, SearchedUser } from './user';

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
    public owner: Account,
    rawData: string
  ) {
    super(parse(rawData, '~'));
  }
}
class LoggedInAccountComment extends AccountComment {
  owner: LoggedInAccount;
  constructor(owner: LoggedInAccount, rawData: string) {
    super(owner, rawData);
  }

  /**
   * Deletes the comment from the Geometry Dash servers
   * @returns A promise that resolves with a boolean of whether deletion was successful
   * @async
   */
  async delete(): Promise<boolean> {
    return this.owner.deleteComment(this);
  }
}

/**
 * A Geometry Dash player's account
 */
class Account {
  /**
   * Create info about a player's account.
   * @param _creator The creator of this account (to connect with the client)
   */
  constructor(
    /** @internal */
    protected _creator: AccountCreator,
    /** This account's ID */
    public id: number
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
        accountID: this.id,
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
      searchedUsers.push(
        ...split.map(str =>
          this instanceof LoggedInAccount
            ? new LoggedInAccountComment(this, str)
            : new AccountComment(this, str)
        )
      );
      if (split.length < 10) break;
    }
    return singleReturn ? searchedUsers[0] || null : searchedUsers.slice(0, num);
  }

  /**
   * Gets the user profile associated with this account.
   * @returns The user whose account ID matches this account's ID
   * @async
   */
  async getUser(): Promise<User> {
    return await this._creator._client.users.get(this);
  }
}

/**
 * A logged in Geometry Dash player's account
 */
class LoggedInAccount extends Account {
  /**
   * Creates info about a logged in player's account
   * @param _creator The creator of the account (to connect with the client)
   * @param _creds The login credentials
   */
  constructor(_creator: AccountCreator, private _creds: Credentials) {
    super(_creator, _creds.accountID);
  }

  /**
   * Get comments posted to this account's page
   * @param num The maximum number of results to fetch. If not specified, a single comment (the most recent one) is returned rather than an array.
   * @returns A comment or an array of comments
   * @async
   */
  async getComments(): Promise<LoggedInAccountComment>;
  async getComments(num: number): Promise<LoggedInAccountComment[]>;
  async getComments(num?: number): Promise<LoggedInAccountComment | LoggedInAccountComment[]> {
    if (typeof num === 'undefined') return (await super.getComments()) as LoggedInAccountComment;
    else return (super.getComments(num) as unknown) as LoggedInAccountComment[];
  }

  /**
   * Post a comment to this account's page
   * @param msg The message to post
   * @returns The comment that was just created (may not be 100% accurate); null if it failed
   * @async
   */
  async postComment(msg: string): Promise<AccountComment> {
    const comment = btoa(msg);
    const params = new GDRequestParams({
      ...this._creds,
      comment
    });
    params.authorize('db');
    const data = await this._creator._client.req('/uploadGJAccComment20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return null;
    return new LoggedInAccountComment(this, `2~${comment}~9~0 seconds~6~${data}~4~0~7~0`); // best we can do
  }

  /**
   *
   * @param commentID The comment (or its ID) to delete
   * @async
   */
  async deleteComment(commentID: number | LoggedInAccountComment): Promise<boolean> {
    if (commentID instanceof LoggedInAccountComment) {
      if (commentID.owner.id === this.id) commentID = commentID.id;
      else return false;
    }
    const params = new GDRequestParams({
      accountID: this._creds.accountID,
      gjp: this._creds.gjp,
      commentID
    });
    params.authorize('db');
    // TODO: What does this return on fail, success?
    return (
      (await this._creator._client.req('/deleteGJAccComment20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }
}

/**
 * A creator for Geometry Dash accounts
 */
class AccountCreator extends Creator {
  /**
   * Gets an account from an account ID, username, user, or searched user
   * @param id The account ID, username, user, or searched user to get the account from
   * @returns The account that matches the given ID
   * @async
   */
  async get(id: number | string | User | SearchedUser): Promise<Account> {
    switch (typeof id) {
      case 'number':
        return await this.getByAccountID(id);
      case 'string':
        return await this.getByUsername(id);
      case 'object': {
        if (id instanceof User || id instanceof SearchedUser)
          return await this.getByAccountID(id.accountID);
      }
      default:
        return null;
    }
  }

  /**
   * Log in to a Geometry Dash account
   * @param userCreds The username and password to log in with
   * @throws {TypeError} Credentials must be valid
   * @async
   */
  async login(userCreds: UserCredentials): Promise<LoggedInAccount> {
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
    return new LoggedInAccount(this, {
      userName: userCreds.username,
      accountID: +accountIDStr,
      gjp
    });
  }

  /**
   * Get an account by its ID
   * @param accountID The account's ID
   * @returns The account with the given ID
   * @async
   */
  async getByAccountID(accountID: number): Promise<Account> {
    return new Account(this, accountID);
  }

  /**
   * Get an account by its username
   * @param str The username to search for
   * @returns The account with the given username
   * @async
   */
  async getByUsername(str: string): Promise<Account> {
    return await this.getByAccountID(
      (await this._client.users.getByUsername(str, false)).accountID
    );
  }
}

export { Account, AccountCreator };
