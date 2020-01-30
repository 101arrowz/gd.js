import {
  Credentials,
  GDRequestParams,
  ParsedData,
  GDDate,
  generateDate,
  parse,
  gdEncodeBase64,
  gdDecodeBase64
} from '../util';
import { User, StatlessSearchedUser, UserCreator } from './user';
/**
 * Types that can be converted to an account
 */
type ConvertibleToAccount = number | string | User | StatlessSearchedUser | Account;
/**
 * Converts multiple datatypes into an account
 * @param creator The creator of the caller
 * @param id The identifier in some datatype
 * @returns The account ID from that identifier
 * @async
 */
const convertToAccount = async (
  creator: UserCreator,
  id: ConvertibleToAccount
): Promise<Account> => {
  if (typeof id === 'string') return (await creator.get(id)).account;
  if (id instanceof StatlessSearchedUser || id instanceof User) return id.account;
  if (id instanceof Account) return id;
  return new Account(creator, id);
};

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
    this.text = gdDecodeBase64(data[2]);
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
    return this.owner.deleteAccountComment(this);
  }
}

/**
 * A friend request
 */
abstract class FriendRequest<O extends boolean> {
  /** The friend request ID */
  id: number;
  /** The message with the friend request */
  msg: string;
  /** Whether the friend request has been read yet */
  read: boolean;
  /** Who the friend request is from */
  from: O extends true ? LoggedInAccount : StatlessSearchedUser;
  /** Who the friend request is to */
  to: O extends true ? StatlessSearchedUser : LoggedInAccount;

  /**
   * Create data about a friend request
   * @param data The parsed data to evaluate
   */
  constructor(data: ParsedData) {
    this.id = +data[32];
    this.msg = gdDecodeBase64(data[35]);
    this.read = !+data[41];
  }
}

/**
 * An outgoing friend request
 */
class OutgoingFriendRequest extends FriendRequest<true> {
  /**
   * Creates info about an outgoing friend request
   * @param account The account that sent the friend request
   * @param creator The creator of the user the account belongs to
   * @param rawData The raw data to parse
   */
  constructor(account: LoggedInAccount, creator: UserCreator, rawData: string) {
    const data = parse(rawData);
    super(data);
    this.from = account;
    this.to = new StatlessSearchedUser(creator, rawData);
  }

  /**
   * Cancels a friend request, deleting it from the server
   * @returns Whether the cancellation was successful
   * @async
   */
  async cancel(): Promise<boolean> {
    return this.from.cancelFriendRequest(this);
  }
}

class IncomingFriendRequest extends FriendRequest<false> {
  /**
   * Creates info about an incoming friend request
   * @param account The account that received the friend request
   * @param creator The creator of the user the account belongs to
   * @param rawData The raw data to parse
   */
  constructor(account: LoggedInAccount, creator: UserCreator, rawData: string) {
    const data = parse(rawData);
    super(data);
    this.to = account;
    this.from = new StatlessSearchedUser(creator, rawData);
  }

  /**
   * Mark a friend request as read
   * @returns Whether marking as read was successful
   * @async
   */
  async markAsRead(): Promise<boolean> {
    return this.read || (this.read = await this.to.markFriendRequestAsRead(this));
  }

  /**
   * Accept a friend request
   * @returns Whether accepting the friend request was successful
   * @async
   */
  async accept(): Promise<boolean> {
    return this.to.acceptFriendRequest(this);
  }

  /**
   * Rejects a friend request, deleting it from the server
   * @returns Whether the rejection was successful
   * @async
   */
  async reject(): Promise<boolean> {
    return this.to.rejectFriendRequest(this);
  }
}

/**
 * A Geometry Dash player's account
 */
class Account {
  /**
   * Create info about a player's account.
   * @param _user The user connected to this account
   * @param id The account ID
   */
  constructor(
    /** @internal */
    protected _creator: UserCreator,
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
   * Gets the user associated with this account
   * @returns The user associated with the account
   * @async
   */
  async getUser(): Promise<User> {
    return this._creator.get(this);
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
  constructor(_creator: UserCreator, private _creds: Credentials) {
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
  async postAccountComment(msg: string): Promise<AccountComment> {
    const comment = gdEncodeBase64(msg);
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
   * Deletes an account comment from the server
   * @param commentID The comment (or its ID) to delete
   * @async
   */
  async deleteAccountComment(commentID: number | LoggedInAccountComment): Promise<boolean> {
    if (commentID instanceof LoggedInAccountComment) {
      if (commentID.owner.id !== this.id) return false;
      commentID = commentID.id;
    }
    const params = new GDRequestParams({
      accountID: this.id,
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

  /**
   * Send a friend request to another player
   * @param id The account ID, username, user, or searched user to send a friend request to
   * @param msg The message to send with the friend request
   * @async
   */
  async sendFriendRequest(id: ConvertibleToAccount, msg = ''): Promise<boolean> {
    const acc = await convertToAccount(this._creator, id);
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      toAccountID: acc.id,
      comment: gdEncodeBase64(msg)
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/uploadFriendRequest20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Gets friend requests
   * @param num The number of friend requests to get. Default 10.
   * @param outgoing Whether to get outgoing or incoming friend requests. Defaults to incoming.
   * @async
   */
  async getFriendRequests(num?: number, outgoing?: false): Promise<IncomingFriendRequest[]>;
  async getFriendRequests(num: number, outgoing: true): Promise<OutgoingFriendRequest[]>;
  async getFriendRequests(
    num = 10,
    outgoing = false
  ): Promise<IncomingFriendRequest[] | OutgoingFriendRequest[]> {
    const numToGet = Math.ceil(num / 10);
    const reqs = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        accountID: this.id,
        gjp: this._creds.gjp,
        page,
        getSent: +outgoing,
        total: 0
      });
      params.authorize('db');
      const data = await this._creator._client.req('/getGJFriendRequests20.php', {
        method: 'POST',
        body: params
      });
      if (['-1', '-2'].includes(data)) return reqs;
      const split = data.slice(0, data.indexOf('#')).split('|');
      reqs.push(
        ...split.map(str =>
          outgoing
            ? new OutgoingFriendRequest(this, this._creator, str)
            : new IncomingFriendRequest(this, this._creator, str)
        )
      );
      if (split.length < 10) break;
    }
    return reqs.slice(0, num);
  }

  /**
   * Mark a friend request as read
   * @param fr The friend request to mark
   * @returns Whether marking as read was successful or not
   * @async
   */
  async markFriendRequestAsRead(fr: IncomingFriendRequest): Promise<boolean> {
    if (fr.to.id !== this.id) return false;
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      requestID: fr.id
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/readGJFriendRequest20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Accepts a friend request
   * @param fr The friend request to accept
   * @returns Whether accepting the friend request was successful
   * @async
   */
  async acceptFriendRequest(fr: IncomingFriendRequest): Promise<boolean> {
    if (fr.to.id !== this.id) return false;
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      requestID: fr.id,
      targetAccountID: fr.from.account.id
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/acceptGJFriendRequest20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Rejects a friend request, deleting it from the server
   * @param fr The friend request to reject
   * @returns Whether the rejection was succesful
   * @async
   */
  async rejectFriendRequest(fr: IncomingFriendRequest): Promise<boolean> {
    if (fr.to.id !== this.id) return false;
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      targetAccountID: fr.from.account.id,
      isSender: 0
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/deleteGJFriendRequests20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Cancels a friend request, deleting it from the server
   * @param fr The friend request to cancel
   * @returns Whether the cancellation was succesful
   */
  async cancelFriendRequest(fr: OutgoingFriendRequest): Promise<boolean> {
    if (fr.from.id !== this.id) return false;
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      targetAccountID: fr.to.account.id,
      isSender: 1
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/deleteGJFriendRequests20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Block a user
   * @param user The user to block
   * @returns Whether the blocking succeeded
   * @async
   */
  async block(user: ConvertibleToAccount): Promise<boolean> {
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      targetAccountID: (await convertToAccount(this._creator, user)).id
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/blockGJUser20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Unblock a user
   * @param user The user to unblock
   * @returns Whether the unblocking succeeded
   * @async
   */
  async unblock(user: ConvertibleToAccount): Promise<boolean> {
    const params = new GDRequestParams({
      accountID: this.id,
      gjp: this._creds.gjp,
      targetAccountID: (await convertToAccount(this._creator, user)).id
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/unblockGJUser20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }
}

export { Account, LoggedInAccount };
