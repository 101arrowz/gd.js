/**
 * User utilities
 * @packageDocumentation
 */

import Client from '..';
import Creator from './entityCreator';
import { SearchedLevel, Level, LoggedInSearchedLevel } from './level';
import {
  parse,
  GDRequestParams,
  accountKey,
  encrypt,
  gdDecodeBase64,
  gdEncodeBase64,
  ParsedData,
  GDDate,
  udid,
  uuid,
  generateDate,
  genRS,
  commentKey,
  commentSalt,
  likeKey,
  likeSalt
} from '../util';
import sha1 from 'sha1';

/**
 * Types that can be converted to an account ID
 */
type ConvertibleToAccountID = number | string | User | StatlessSearchedUser;

/**
 * Converts multiple datatypes into an account
 * @param creator The creator of the caller
 * @param id The identifier in some datatype
 * @returns The account ID from that identifier
 * @async
 * @internal
 */
const convertToAccountID = async (
  creator: UserCreator,
  id: ConvertibleToAccountID
): Promise<number> => {
  if (typeof id === 'string') return (await creator.get(id)).accountID;
  if (id instanceof StatlessSearchedUser || id instanceof User) return id.accountID;
  return id;
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
  /** The number of likes on the comment */
  likes: number;
  /** Whether or not the comment has been marked as spam */
  isSpam: boolean;
  /** The comment's author */
  author: StatlessSearchedUser | User;

  /**
   * Creates a comment from a server response
   * @param data The parsed data for the comment
   * @internal
   */
  constructor(data: ParsedData) {
    this.text = gdDecodeBase64(data[2]);
    this.createdAt = generateDate(data[9]);
    this.id = +data[6];
    this.likes = +data[4];
    this.isSpam = !!+data[7];
  }
}

class AccountComment<T extends User | StatlessSearchedUser> extends Comment {
  author: T;

  /**
   * Creates info about an account comment
   * @param author The comment's author
   * @param rawData The raw data to parse
   * @internal
   */
  constructor(author: T, rawData: string) {
    super(parse(rawData, '~'));
    this.author = author;
  }
}

class LoggedInAccountComment extends AccountComment<LoggedInUser> {
  /**
   * Deletes the comment from the Geometry Dash servers
   * @returns A promise that resolves with a boolean of whether deletion was successful
   * @async
   */
  async delete(): Promise<boolean> {
    return this.author.deleteAccountComment(this);
  }
}

class LevelComment<T extends User | StatlessSearchedUser> extends Comment {
  /** @internal */
  protected _creator: UserCreator;
  author: T;
  /** The ID of the level this comment is from */
  levelID: number;
  /** The percentage the user reached on the level. Only present if the commenter opted to show percentage with their comment. */
  percent?: number;

  /**
   * Creates info about a level comment
   * @param _creator The level creator associated with this comment
   * @param author The comment's author
   * @param rawData The raw data to parse
   * @internal
   */
  constructor(_creator: UserCreator, author: T, rawData: string) {
    const d = parse(rawData, '~');
    super(d);
    this.author = author;
    this._creator = _creator;
    this.levelID = +d[1];
    if (d[10] !== '0') this.percent = +d[10];
  }

  /**
   * Gets the level associated with this comment
   * @param resolve Whether or not to resolve the search into the full level
   * @returns The level or searched level this comment belongs to
   * @async
   */
  async getLevel(resolve?: false): Promise<SearchedLevel>;
  /**
   * Gets the level associated with this comment
   * @param resolve Whether or not to resolve the search into the full level
   * @returns The level or searched level this comment belongs to
   * @async
   */
  async getLevel(resolve: true): Promise<Level>;
  async getLevel(resolve = false): Promise<Level | SearchedLevel> {
    const level = await this._creator._client.levels.get(this.levelID);
    return resolve ? level.resolve() : level;
  }
}

class LoggedInLevelComment extends LevelComment<LoggedInUser> {
  /**
   * Deletes this comment from the servers
   * @returns Whether the comment deletion was successful
   * @async
   */
  async delete(): Promise<boolean> {
    return await this.author.deleteComment(this);
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
  from: O extends true ? LoggedInUser : StatlessSearchedUser;
  /** Who the friend request is to */
  to: O extends true ? StatlessSearchedUser : LoggedInUser;

  /**
   * Create data about a friend request
   * @param data The parsed data to evaluate
   * @internal
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
  constructor(account: LoggedInUser, creator: UserCreator, rawData: string) {
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
   * @internal
   */
  constructor(account: LoggedInUser, creator: UserCreator, rawData: string) {
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
    return this.read || (await this.to.markFriendRequestAsRead(this));
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
type MessageUser = {
  /** The player's username */
  username: string;
  /** The player's user ID */
  id: number;
  /** The player's account ID */
  accountID: number;
};
class SearchedMessage<O extends boolean> {
  /** The message's ID */
  id: number;
  /** The message's subject */
  subject: string;
  /** The message's sender */
  from: O extends true ? LoggedInUser : MessageUser;
  /** The message's recipient */
  to: O extends true ? MessageUser : LoggedInUser;
  /** When the message was sent */
  sentAt: GDDate;
  /** Whether the message has been read */
  read: boolean;
  /** Whether the message is outgoing or not */
  outgoing: O;

  /**
   * Creates info about a searched message
   * @param account The account associated with this message
   * @param rawData The raw data to parse (or its parsed form)
   * @internal
   */
  constructor(account: LoggedInUser, rawData: string | ParsedData) {
    const d = typeof rawData === 'string' ? parse(rawData) : rawData;
    this.id = +d[1];
    const otherAcc: MessageUser = {
      username: d[6],
      id: +d[3],
      accountID: +d[2]
    };
    const outgoing = !!+d[9];
    this.from = (outgoing ? account : otherAcc) as this['from'];
    this.to = (outgoing ? otherAcc : account) as this['to'];
    this.outgoing = outgoing as O;
    this.subject = gdDecodeBase64(d[4]);
    this.sentAt = generateDate(d[7]);
    this.read = !+d[8];
  }

  /**
   * Deletes this message from the server
   * @returns Whether the message deletion was successful
   * @async
   */
  async delete(): Promise<boolean> {
    return await ((this.outgoing ? this.from : this.to) as LoggedInUser).deleteMessage(this);
  }

  /**
   * Resolves the message into a full message
   * @returns The full message from this searched message
   * @async
   */
  async resolve(): Promise<Message<O>> {
    return await ((this.outgoing ? this.from : this.to) as LoggedInUser).getFullMessage(this);
  }
}

class Message<O extends boolean> extends SearchedMessage<O> {
  /** The message's body */
  body: string;

  /**
   * Creates info about a message
   * @param account The account associated with this message
   * @param rawData The raw data to parse
   * @internal
   */
  constructor(account: LoggedInUser, rawData: string) {
    const d = parse(rawData);
    super(account, d);
    this.body = gdDecodeBase64(d[5]);
  }
}

/** @internal */
const colors = [
  '#7dff00',
  '#00ff00',
  '#00ff7d',
  '#00ffff',
  '#007dff',
  '#0000ff',
  '#7d00ff',
  '#ff00ff',
  '#ff007d',
  '#ff0000',
  '#ff7d00',
  '#ffff00',
  '#ffffff',
  '#b900ff',
  '#ffb900',
  '#000000',
  '#00c8ff',
  '#afafaf',
  '#5a5a5a',
  '#ff7d7d',
  '#00af4b',
  '#007d7d',
  '#004baf',
  '#4b00af',
  '#7d007d',
  '#af004b',
  '#af4b00',
  '#7d7d00',
  '#4baf00',
  '#ff4b00',
  '#963200',
  '#966400',
  '#649600',
  '#009664',
  '#006496',
  '#640096',
  '#960064',
  '#960000',
  '#009600',
  '#000096',
  '#7dffaf',
  '#7d7dff'
];

/**
 * A color used by a Geometry Dash player.
 */
type GDColor = {
  /**
   * The raw color number, as returned by the server
   */
  raw: number;
  /**
   * The color in hexadecimal notation
   */
  parsed: string;
};

/**
 * Generates a {@link GDColor} from a number returned by the Geometry Dash servers.
 * @param colorValue The color number from the Geometry Dash servers
 * @returns The {@link GDColor} representing the given color number
 * @internal
 */
const userColor = (colorValue: number): GDColor => ({
  raw: colorValue,
  parsed: colors[colorValue]
});

type PermissionLevel = 'User' | 'Moderator' | 'Elder Moderator';

/** @internal */
const PERMISSIONS: PermissionLevel[] = ['User', 'Moderator', 'Elder Moderator'];

/**
 * A permission level for a Geometry Dash player.
 */
type Permission = {
  /** The raw permission number, as returned by the server. 0 = user, 1 = mod, 2 = elder mod. */
  raw: 0 | 1 | 2;
  /** A prettified string for the permission level. One of "User", "Moderator" or "Elder Moderator" */
  pretty: PermissionLevel;
};

/**
 * Generates a {@link Permission} from a number returned by the Geometry Dash servers.
 * @param raw The permission number from the Geometry Dash servers
 * @returns The {@link Permission} representing the given permission number
 * @internal
 */
const generatePermission = (raw: number): Permission => ({
  raw: raw as Permission['raw'],
  pretty: PERMISSIONS[raw]
});

/** @internal */
const SOCIALMAP = {
  youtube: 'https://youtube.com/channel/',
  twitch: 'https://twitch.tv/',
  twitter: 'https://twitter.com/'
};

/**
 * A social media platform that a Geometry Dash player uses
 */
type SocialURL = {
  /** The path to the player's social media from the platform's base URL */
  path: string;
  /** The full URL path to the player's social media */
  fullURL: string;
};

/**
 * Generates a {@link SocialURL} from a path and type returned by the Geometry Dash servers.
 * @param path The path from the Geometry Dash servers
 * @param type The social media platform from the Geometry Dash servers
 * @returns The {@link SocialURL} representing the given social media
 * @internal
 */
const generateSocial = (path: string, type: keyof typeof SOCIALMAP): SocialURL => ({
  path,
  fullURL: SOCIALMAP[type] + path
});

/**
 * An icon type
 */
type IconCosmetic = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'spider' | 'robot';
/**
 * The colors in a Geometry Dash user's profile
 */
type Colors = { primary: GDColor; secondary: GDColor };
/**
 * A Geometry Dash player's cosmetics
 */
class UserCosmetics {
  /** The player's raw explosion number */
  explosion?: number;

  /** @internal */
  constructor(
    /** @internal */
    private _creator: UserCreator,
    /** The player's raw cube number */
    public cube: number,
    /** The player's raw ship number */
    public ship: number,
    /** The player's raw ball number */
    public ball: number,
    /** The player's raw UFO number */
    public ufo: number,
    /** The player's raw wave number */
    public wave: number,
    /** The player's raw robot number */
    public robot: number,
    /** The player's raw glow number */
    public glow: number,
    /** The player's raw spider number */
    public spider: number,
    explosion: number,
    /** The colors the player uses */
    public colors: Colors
  ) {
    if (!isNaN(explosion)) this.explosion = explosion;
  }

  /**
   * Renders one of the user's icons as an image using the GDBrowser API
   * @param type The type of icon to render
   * @param returnRaw Whether to return a raw Response or an ArrayBuffer
   * @returns The Response or ArrayBuffer containing the image
   * @async
   */
  async renderIcon(type: IconCosmetic, returnRaw?: false): Promise<ArrayBuffer>;
  async renderIcon(type: IconCosmetic, returnRaw: true): Promise<Response>;
  async renderIcon(
    type: IconCosmetic = 'cube',
    returnRaw = false
  ): Promise<Response | ArrayBuffer> {
    const params = [
      ['form', type],
      ['icon', this[type].toString()],
      ['col1', this.colors.primary.raw.toString()],
      ['col2', this.colors.secondary.raw.toString()],
      ['glow', this.glow.toString()],
      ['noUser', '1']
    ]
      .map(([x, y]) => x + '=' + y)
      .join('&');
    const response = await this._creator._client.req(
      `https://gdbrowser.com/icon/gd.js?${params}`,
      {},
      true
    );
    if (returnRaw) return response;
    return response.arrayBuffer();
  }
}

/**
 * The social media platforms a Geometry Dash player uses
 */
type Socials = {
  /** The player's YouTube channel */
  youtube?: SocialURL;
  /** The player's Twitter account */
  twitter?: SocialURL;
  /** The player's Twitch channel */
  twitch?: SocialURL;
};

/**
 * A Geometry Dash player
 */
class User {
  /** The player's username  */
  username: string;
  /** The player's user ID */
  id: number;
  /** The player's account ID */
  accountID: number;
  /** The player's stats */
  stats: {
    /** The number of stars the player has collected */
    stars: number;
    /** The number of diamonds the player has collected */
    diamonds: number;
    /** The number of demons the player has beaten */
    demons: number;
    /** The global rank of the player */
    rank: number;
    /** The coins the player has collected */
    coins: {
      /** The number of coins in the single-player mode (gold coins) the player has collected */
      normal: number;
      /** The number of coins in user-created levels (silver coins) the player has collected */
      user: number;
    };
    /** The number of creator points the player has earned */
    cp: number;
  };
  /** The player's social media profiles */
  socials: Readonly<Socials>;
  /** The player's cosmetics */
  cosmetics: UserCosmetics;
  /** The player's permissions */
  permissions: Permission;

  /**
   * Constructs data about a Geometry Dash player
   * @param _creator The creator associated with this user
   * @param rawData The raw data returned from the Geometry Dash request for this user
   * @internal
   */
  constructor(
    /** @internal */
    protected _creator: UserCreator,
    rawData: string
  ) {
    const d = parse(rawData);
    this.username = d[1];
    this.id = +d[2];
    this.accountID = +d[16];
    this.stats = {
      stars: +d[3],
      diamonds: +d[46],
      demons: +d[4],
      rank: +d[30],
      coins: {
        normal: +d[13],
        user: +d[17]
      },
      cp: +d[8]
    };
    const socials: Socials = {};
    if (d[20]) socials.youtube = generateSocial(d[20], 'youtube');
    if (d[44]) socials.twitter = generateSocial(d[44], 'twitter');
    if (d[45]) socials.twitch = generateSocial(d[45], 'twitch');
    this.socials = socials;
    this.cosmetics = new UserCosmetics(
      _creator,
      +d[21],
      +d[22],
      +d[23],
      +d[24],
      +d[25],
      +d[26],
      +d[28],
      +d[43],
      +d[47],
      {
        primary: userColor(+d[10]),
        secondary: userColor(+d[11])
      }
    );
    this.permissions = generatePermission(+d[49]);
  }

  /**
   * Get the most recent comment posted to this account's page
   * @returns The most recent comment
   * @async
   */
  async getAccountComments(): Promise<AccountComment<this>>;
  /**
   * Get the comments posted to this account's page
   * @param num The maximum number of comments to get
   * @returns An array of this user's profile comments
   * @async
   */
  async getAccountComments(num: number): Promise<AccountComment<this>[]>;
  async getAccountComments(num?: number): Promise<AccountComment<this> | AccountComment<this>[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const numToGet = Math.ceil(num / 10);
    const comments: AccountComment<this>[] = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        accountID: this.accountID,
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
      comments.push(
        ...split.map(str =>
          this instanceof LoggedInUser
            ? ((new LoggedInAccountComment(this, str) as unknown) as AccountComment<this>)
            : new AccountComment(this, str)
        )
      );
      if (split.length < 10) break;
    }
    return singleReturn ? comments[0] || null : comments.slice(0, num);
  }

  /**
   * Gets the most recent or most liked level comment by the user
   * @param byLikes Whether to sort by likes or not
   * @returns The most recent or most liked comment made by this user
   * @async
   */
  async getComments(byLikes?: boolean): Promise<LevelComment<this>>;
  /**
   * Gets the most recent or most liked level comments by the user
   * @param byLikes Whether to sort by likes or not
   * @param num The number of comments to get
   * @returns An array of the most recent or most liked comments made by this user
   * @async
   */
  async getComments(byLikes: boolean, num: number): Promise<LevelComment<this>[]>;
  async getComments(
    byLikes = false,
    num?: number
  ): Promise<LevelComment<this> | LevelComment<this>[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const params = new GDRequestParams({
      count: num,
      userID: this.id,
      mode: +byLikes,
      page: 0,
      total: 0
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJCommentHistory.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return singleReturn ? null : [];
    const comments = data
      .slice(0, data.indexOf('#'))
      .split('|')
      .map(str => {
        const comment = str.slice(0, str.indexOf(':'));
        return this instanceof LoggedInUser
          ? ((new LoggedInLevelComment(this._creator, this, comment) as unknown) as LevelComment<
              this
            >)
          : new LevelComment(this._creator, this, comment);
      });
    return singleReturn ? comments[0] : comments;
  }

  /**
   * Gets the most recent level by the user
   * @returns The most recent level made by this user
   * @async
   */
  async getLevels(): Promise<this extends LoggedInUser ? LoggedInSearchedLevel : SearchedLevel>;
  /**
   * Gets the most recentlevels by the user
   * @param num The number of levels to get
   * @returns An array of the most recent levels made by this user
   * @async
   */
  async getLevels(
    num: number
  ): Promise<(this extends LoggedInUser ? LoggedInSearchedLevel : SearchedLevel)[]>;
  async getLevels(num?: number): Promise<SearchedLevel | SearchedLevel[]> {
    return this._creator._client.levels.byCreator(this, {}, num);
  }
}

/**
 * Likes an arbitrary Geometry Dash object
 * @param id The ID of the object to like
 * @param special The special string associated with this like type
 * @param type The like type
 * @param shouldLike Whather to like or not
 * @param accountID The account ID from which to like
 * @param gjp The GJP of the account
 * @param client The client to make the request from
 * @returns Whether liking was successful
 * @internal
 */
const like = async (
  id: number,
  special: number,
  type: number,
  shouldLike: boolean,
  accountID: number,
  gjp: string,
  client: Client
): Promise<boolean> => {
  const rs = genRS();
  const like = +shouldLike;
  const chk = encrypt(
    sha1('' + special + id + like + type + rs + accountID + udid + uuid + likeSalt),
    likeKey
  );
  const params = new GDRequestParams({
    accountID,
    gjp,
    type,
    special,
    itemID: id,
    like,
    udid,
    uuid,
    rs,
    chk
  });
  params.authorize('db');
  return (
    (await client.req('/likeGJItem211.php', {
      method: 'POST',
      body: params
    })) === '1'
  );
};

/**
 * Credentials to use in requests to Geometry Dash servers
 */
export type Credentials = {
  /** The player's username */
  userName: string;
  /** The player's account ID */
  accountID: number;
  /** The player's password, XOR-encrypted */
  gjp: string;
};

/**
 * A logged-in Geometry Dash player
 */
class LoggedInUser extends User {
  constructor(
    _creator: UserCreator,
    rawData: string,
    /** @internal */
    private _creds: Credentials
  ) {
    super(_creator, rawData);
  }

  /**
   * Post a comment to this account's page
   * @param msg The message to post
   * @returns The comment that was just created (may not be 100% accurate); null if it failed
   * @async
   */
  async postAccountComment(msg: string): Promise<LoggedInAccountComment> {
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
   * Post a comment to a level
   * @param level The level to post the comment on
   * @param msg The message to post
   * @param percent The percentage to post with the comment. This can be any integer (even above 100)
   * @returns The comment that was just created (may not be 100% accurate); null if it failed
   * @async
   */
  async postComment(
    level: SearchedLevel | number,
    msg: string,
    percent?: number
  ): Promise<LoggedInLevelComment> {
    if (level instanceof SearchedLevel) level = level.id;
    if (!percent) percent = 0;
    const comment = gdEncodeBase64(msg);
    const chk = encrypt(
      sha1(this._creds.userName + comment + level + percent + '0' + commentSalt),
      commentKey
    );
    const params = new GDRequestParams({
      ...this._creds,
      levelID: level,
      comment,
      percent,
      chk
    });
    params.authorize('db');
    const data = await this._creator._client.req('/uploadGJComment21.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return null;
    return new LoggedInLevelComment(
      this._creator,
      this,
      `2~${comment}~9~0 seconds~6~${data}~4~0~7~0~10~${percent}`
    );
  }

  /**
   * Deletes an account comment from the server
   * @param commentID The comment (or its ID) to delete
   * @async
   */
  async deleteAccountComment(commentID: number | AccountComment<User>): Promise<boolean> {
    if (commentID instanceof AccountComment) {
      if (commentID.author.accountID !== this.accountID) return false;
      commentID = commentID.id;
    }
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      commentID
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/deleteGJAccComment20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Deletes a comment from the server
   * @param commentID The comment ID to delete
   * @param levelID The level ID where the comment was posted
   * @returns Whether the comment deletion was successful
   * @async
   */
  async deleteComment(commentID: number, levelID: number | SearchedLevel): Promise<boolean>;
  /**
   * Deletes a comment from the server
   * @param commentID The comment object to delete
   * @returns Whether the comment deletion was successful
   * @async
   */
  async deleteComment(commentID: LevelComment<User>): Promise<boolean>;
  async deleteComment(
    commentID: number | LevelComment<User>,
    levelID?: number | SearchedLevel
  ): Promise<boolean> {
    if (commentID instanceof LevelComment) {
      if (commentID.author.accountID !== this.accountID) return false;
      levelID = commentID.levelID;
      commentID = commentID.id;
    } else if (levelID instanceof SearchedLevel) {
      levelID = levelID.id;
    }
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      commentID,
      levelID
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/deleteGJComment20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Send a friend request to another player
   * @param id The account ID, username, user, or searched user to send a friend request to
   * @param msg The message to send with the friend request
   * @returns Whether the friend request sending was successful
   * @async
   */
  async sendFriendRequest(id: ConvertibleToAccountID, msg = ''): Promise<boolean> {
    const toAccountID = await convertToAccountID(this._creator, id);
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      toAccountID,
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
   * Sends a message to a friend
   * @param id The account ID, username, user, or searched user to message. Must be a friend of this account.
   * @param subject The subject of the message to send
   * @param body The body of the message to send
   * @returns Whether sending the message was successful
   * @async
   */
  async sendMessage(id: ConvertibleToAccountID, subject: string, body: string): Promise<boolean> {
    const toAccountID = await convertToAccountID(this._creator, id);
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      toAccountID,
      subject: gdEncodeBase64(subject),
      body: gdEncodeBase64(body)
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/uploadGJMessage20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Gets friend requests
   * @param num The number of friend requests to get. Default 10.
   * @param outgoing Whether to get outgoing or incoming friend requests. Defaults to incoming.
   * @returns The array of friend requests based on the provided parameters
   * @async
   */
  async getFriendRequests(num?: number, outgoing?: false): Promise<IncomingFriendRequest[]>;
  /**
   * Gets friend requests
   * @param num The number of friend requests to get. Default 10.
   * @param outgoing Whether to get outgoing or incoming friend requests. Defaults to incoming.
   * @returns The array of friend requests based on the provided parameters
   * @async
   */
  async getFriendRequests(num: number, outgoing: true): Promise<OutgoingFriendRequest[]>;
  async getFriendRequests(
    num = 10,
    outgoing = false
  ): Promise<IncomingFriendRequest[] | OutgoingFriendRequest[]> {
    const numToGet = Math.ceil(num / 10);
    const reqs = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        accountID: this.accountID,
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
   * Gets messages sent to or from this user
   * @param num The number of messages to get. Defaults to 10.
   * @param outgoing Whether to get outgoing or incoming messages. Defaults to incoming.
   * @returns An array of incoming or outgoing messages
   * @async
   */
  async getMessages(num?: number, outgoing?: false): Promise<SearchedMessage<false>[]>;
  /**
   * Gets messages sent to or from this user
   * @param num The number of messages to get. Defaults to 10.
   * @param outgoing Whether to get outgoing or incoming messages. Defaults to incoming.
   * @returns An array of incoming or outgoing messages
   * @async
   */
  async getMessages(num: number, outgoing: true): Promise<SearchedMessage<true>[]>;
  async getMessages(num = 10, outgoing = false): Promise<SearchedMessage<boolean>[]> {
    const numToGet = Math.ceil(num / 10);
    const msgs: SearchedMessage<boolean>[] = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        accountID: this.accountID,
        gjp: this._creds.gjp,
        page,
        getSent: +outgoing,
        total: 0
      });
      params.authorize('db');
      const data = await this._creator._client.req('/getGJMessages20.php', {
        method: 'POST',
        body: params
      });
      if (['-1', '-2'].includes(data)) return msgs;
      const split = data.slice(0, data.indexOf('#')).split('|');
      msgs.push(
        ...split.map(str =>
          outgoing ? new SearchedMessage<true>(this, str) : new SearchedMessage<false>(this, str)
        )
      );
      if (split.length < 10) break;
    }
    return msgs.slice(0, num);
  }

  /**
   * Gets the full message from a searched message
   * @param messageID The message object to resolve
   * @returns The full message, including the body
   * @async
   */
  async getFullMessage<T extends boolean>(messageID: SearchedMessage<T>): Promise<Message<T>>;
  /**
   * Gets the full message from a searched message
   * @param messageID The message ID to resolve
   * @param outgoing Whether the message is outgoing or not
   * @returns The full message, including the body
   * @async
   */
  async getFullMessage<T extends boolean>(
    messageID: number,
    outgoing: boolean
  ): Promise<Message<T>>;
  async getFullMessage<T extends boolean>(
    messageID: SearchedMessage<T> | number,
    outgoing?: boolean
  ): Promise<Message<T>> {
    if (messageID instanceof SearchedMessage) {
      if ((messageID.outgoing ? messageID.from : messageID.to).accountID !== this.accountID)
        return null;
      outgoing = messageID.outgoing;
      messageID = messageID.id;
    }
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      messageID,
      isSender: +outgoing
    });
    params.authorize('db');
    const data = await this._creator._client.req('/downloadGJMessage20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return null;
    return new Message<T>(this, data);
  }

  /**
   * Deletes a message from the servers
   * @param message The message object to delete
   * @returns Whether the message deletion was successful
   * @async
   */
  async deleteMessage(messageID: SearchedMessage<boolean>): Promise<boolean>;
  /**
   * Deletes a message from the servers
   * @param message The message ID to delete
   * @param outgoing Whether the message is outgoing or not
   * @returns Whether the message deletion was successful
   * @async
   */
  async deleteMessage(messageID: number, outgoing: boolean): Promise<boolean>;
  async deleteMessage(
    messageID: SearchedMessage<boolean> | number,
    outgoing?: boolean
  ): Promise<boolean> {
    if (messageID instanceof SearchedMessage) {
      if ((messageID.outgoing ? messageID.from : messageID.to).accountID !== this.accountID)
        return false;
      outgoing = messageID.outgoing;
      messageID = messageID.id;
    }
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      messageID,
      isSender: +outgoing
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/deleteGJMessages20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Mark a friend request as read
   * @param fr The friend request to mark
   * @returns Whether marking as read was successful or not
   * @async
   */
  async markFriendRequestAsRead(fr: IncomingFriendRequest): Promise<boolean> {
    if (fr.to.accountID !== this.accountID) return false;
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      requestID: fr.id
    });
    params.authorize('db');
    return (fr.read =
      (await this._creator._client.req('/readGJFriendRequest20.php', {
        method: 'POST',
        body: params
      })) === '1');
  }

  /**
   * Accepts a friend request
   * @param fr The friend request to accept
   * @returns Whether accepting the friend request was successful
   * @async
   */
  async acceptFriendRequest(fr: IncomingFriendRequest): Promise<boolean> {
    if (fr.to.accountID !== this.accountID) return false;
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      requestID: fr.id,
      targetAccountID: fr.from.accountID
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
    if (fr.to.accountID !== this.accountID) return false;
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      targetAccountID: fr.from.accountID,
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
   * Unfriends another player.
   * @param id The account ID, username, user, or searched user to message. Must be a friend of this account.
   * @returns Whether the unfriending was successful
   * @async
   */
  async unfriend(id: ConvertibleToAccountID): Promise<boolean> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      targetAccountID: await convertToAccountID(this._creator, id)
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/removeGJFriend20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Cancels a friend request, deleting it from the server
   * @param fr The friend request to cancel
   * @returns Whether the cancellation was succesful
   * @async
   */
  async cancelFriendRequest(fr: OutgoingFriendRequest): Promise<boolean> {
    if (fr.from.accountID !== this.accountID) return false;
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      targetAccountID: fr.to.accountID,
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
  async block(user: ConvertibleToAccountID): Promise<boolean> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      targetAccountID: await convertToAccountID(this._creator, user)
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
  async unblock(user: ConvertibleToAccountID): Promise<boolean> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      targetAccountID: await convertToAccountID(this._creator, user)
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/unblockGJUser20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }

  /**
   * Finds all friends of this player
   * @returns An array of the player's friends
   * @async
   */
  async getFriends(): Promise<StatlessSearchedUser[]> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      type: 0
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJUserList20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return [];
    return data.split('|').map(str => new StatlessSearchedUser(this._creator, parse(str)));
  }

  /**
   * Finds the users that have been blocked by this player
   * @returns An array of blocked users
   * @async
   */
  async getBlocked(): Promise<StatlessSearchedUser[]> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      type: 1
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJUserList20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return [];
    return data.split('|').map(str => new StatlessSearchedUser(this._creator, parse(str)));
  }

  /**
   * Gets the friends leaderboard
   * @returns The leaderboard, with position being index + 1
   * @async
   */
  async getFriendsLeaderboard(): Promise<SearchedUser[]> {
    const params = new GDRequestParams({
      accountID: this.accountID,
      gjp: this._creds.gjp,
      type: 'friends',
      page: 0,
      total: 0
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJScores20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return [];
    const leaderboard = data
      .slice(0, data.indexOf('#'))
      .split('|')
      .map(str => new SearchedUser(this._creator, str));
    const me = leaderboard.pop();
    let insertIndex = leaderboard.findIndex(val => val.stats.stars <= me.stats.stars);
    if (insertIndex === -1) insertIndex = leaderboard.length;
    leaderboard.splice(insertIndex, 0, me);
    return leaderboard;
  }

  /**
   * Likes a Geometry Dash entity
   * @param id The object to like. This can be a level, account comment, or level comment
   * @returns Whether the liking succeeded
   * @async
   */
  async like(
    id:
      | SearchedLevel
      | AccountComment<User | StatlessSearchedUser>
      | LevelComment<User | StatlessSearchedUser>
  ): Promise<boolean> {
    return id instanceof SearchedLevel
      ? this.likeLevel(id)
      : id instanceof LevelComment
      ? this.likeComment(id)
      : id instanceof AccountComment
      ? this.likeAccountComment(id)
      : false;
  }

  /**
   * Dislikes a Geometry Dash entity
   * @param id The object to dislike. This can be a level, account comment, or level comment
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislike(
    id:
      | SearchedLevel
      | AccountComment<User | StatlessSearchedUser>
      | LevelComment<User | StatlessSearchedUser>
  ): Promise<boolean> {
    return id instanceof SearchedLevel
      ? this.dislikeLevel(id)
      : id instanceof LevelComment
      ? this.dislikeComment(id)
      : id instanceof AccountComment
      ? this.dislikeAccountComment(id)
      : false;
  }

  /**
   * Likes a level
   * @param id The ID of the level to like (or the level itself)
   * @returns Whether the liking succeeded
   * @async
   */
  async likeLevel(id: SearchedLevel | number): Promise<boolean> {
    if (id instanceof SearchedLevel) {
      id = id.id;
    }
    return await like(id, 0, 1, true, this.accountID, this._creds.gjp, this._creator._client);
  }

  /**
   * Dislikes a level
   * @param id The ID of the level to dislike (or the level itself)
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislikeLevel(id: SearchedLevel | number): Promise<boolean> {
    if (id instanceof SearchedLevel) {
      id = id.id;
    }
    return await like(id, 0, 1, false, this.accountID, this._creds.gjp, this._creator._client);
  }

  /**
   * Likes a comment
   * @param id The comment object to like
   * @returns Whether the liking succeeded
   * @async
   */
  async likeComment(id: LevelComment<StatlessSearchedUser | User>): Promise<boolean>;
  /**
   * Likes a comment
   * @param id The ID of the comment to like
   * @param levelID The ID of the level the comment is on
   * @returns Whether the liking succeeded
   * @async
   */
  async likeComment(id: number, levelID: SearchedLevel | number): Promise<boolean>;
  async likeComment(
    id: LevelComment<StatlessSearchedUser | User> | number,
    levelID?: SearchedLevel | number
  ): Promise<boolean> {
    if (id instanceof LevelComment) {
      if (id.author.accountID === this.accountID) return false;
      levelID = id.levelID;
      id = id.id;
    } else if (levelID instanceof SearchedLevel) levelID = levelID.id;
    return await like(id, levelID, 2, true, this.accountID, this._creds.gjp, this._creator._client);
  }

  /**
   * Dislikes a comment
   * @param id The comment object to dislike
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislikeComment(id: LevelComment<StatlessSearchedUser | User>): Promise<boolean>;
  /**
   * Dislikes a comment
   * @param id The ID of the comment to dislike
   * @param levelID The ID of the level the comment is on
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislikeComment(id: number, levelID: SearchedLevel | number): Promise<boolean>;
  async dislikeComment(
    id: LevelComment<StatlessSearchedUser | User> | number,
    levelID?: SearchedLevel | number
  ): Promise<boolean> {
    if (id instanceof LevelComment) {
      if (id.author.accountID === this.accountID) return false;
      levelID = id.levelID;
      id = id.id;
    } else if (levelID instanceof SearchedLevel) levelID = levelID.id;
    return await like(
      id,
      levelID,
      2,
      false,
      this.accountID,
      this._creds.gjp,
      this._creator._client
    );
  }

  /**
   * Likes an account comment
   * @param id The account comment object to like
   * @returns Whether the liking succeeded
   * @async
   */
  async likeAccountComment(id: AccountComment<StatlessSearchedUser | User>): Promise<boolean>;
  /**
   * Likes an account comment
   * @param id The ID of the account comment to like
   * @param accountID The account ID of the profile the comment is on
   * @returns Whether the liking succeeded
   * @async
   */
  async likeAccountComment(
    id: number,
    accountID: StatlessSearchedUser | User | number
  ): Promise<boolean>;
  async likeAccountComment(
    id: AccountComment<StatlessSearchedUser | User> | number,
    accountID?: StatlessSearchedUser | User | number
  ): Promise<boolean> {
    if (id instanceof AccountComment) {
      accountID = id.author.accountID;
      if (accountID === this.accountID) return false;
      id = id.id;
    } else if (accountID instanceof StatlessSearchedUser || accountID instanceof User)
      accountID = accountID.accountID;
    return await like(
      id,
      accountID,
      3,
      true,
      this.accountID,
      this._creds.gjp,
      this._creator._client
    );
  }

  /**
   * Dislikes an account comment
   * @param id The account comment object to dislike
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislikeAccountComment(id: AccountComment<StatlessSearchedUser | User>): Promise<boolean>;
  /**
   * Dislikes an account comment
   * @param id The ID of the account comment to dislike
   * @param accountID The account ID of the profile the comment is on
   * @returns Whether the disliking succeeded
   * @async
   */
  async dislikeAccountComment(
    id: number,
    accountID: StatlessSearchedUser | User | number
  ): Promise<boolean>;
  async dislikeAccountComment(
    id: AccountComment<StatlessSearchedUser | User> | number,
    accountID?: StatlessSearchedUser | User | number
  ): Promise<boolean> {
    if (id instanceof AccountComment) {
      accountID = id.author.accountID;
      if (accountID === this.accountID) return false;
      id = id.id;
    } else if (accountID instanceof StatlessSearchedUser || accountID instanceof User)
      accountID = accountID.accountID;
    return await like(
      id,
      accountID,
      3,
      false,
      this.accountID,
      this._creds.gjp,
      this._creator._client
    );
  }

  /**
   * Updates a level's description
   * @param levelID The level ID to update the description for
   * @param desc The new description for the level
   * @returns Whether or not the level description update succeeded
   */
  async updateLevelDescription(levelID: number, desc: string): Promise<boolean>;
  /**
   * Updates a level's description
   * @param levelID The level object to update the description for
   * @param desc The new description for the level
   * @returns Whether or not the level description update succeeded
   */
  async updateLevelDescription(levelID: SearchedLevel, desc: string): Promise<boolean>;
  async updateLevelDescription(levelID: number | SearchedLevel, desc: string): Promise<boolean> {
    if (levelID instanceof SearchedLevel) {
      if (levelID.creator.id !== this.id) {
        return false;
      }
      levelID = levelID.id;
    }
    const params = new GDRequestParams({
      ...this._creds,
      levelID,
      levelDesc: gdEncodeBase64(desc)
    });
    params.authorize('db');
    return (
      (await this._creator._client.req('/updateGJDesc20.php', {
        method: 'POST',
        body: params
      })) === '1'
    );
  }
}

/** @internal */
const ICONTYPEMAP: IconCosmetic[] = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];

/**
 * Cosmetics of a user found by a search
 */
class SearchedUserCosmetics {
  /** The player's default icon */
  icon: {
    /** The numeric value of the icon, as provided by the Geometry Dash servers */
    val: number;
    /** The type of the icon */
    type: IconCosmetic;
  };
  /** The colors the player uses */
  colors: Colors;

  /**
   * Creates new info about a searched user's cosmetics
   * @param icon The number of the icon
   * @param iconType The type of the icon
   * @param colors The colors the player uses
   */
  constructor(
    /** @internal */
    private _creator: UserCreator,
    icon: number,
    iconType: IconCosmetic,
    colors: Colors
  ) {
    this.icon = {
      val: icon,
      type: iconType
    };
    this.colors = colors;
  }

  /**
   * Renders the user's selected default icon as an image using the GDBrowser API
   * @param returnRaw Whether to return a raw Response (true) or an ArrayBuffer (false). Defaults to false.
   * @returns The Response or ArrayBuffer containing the image
   * @async
   */
  async renderIcon(returnRaw?: false): Promise<ArrayBuffer>;
  /**
   * Renders the user's selected default icon as an image using the GDBrowser API
   * @param returnRaw Whether to return a raw Response (true) or an ArrayBuffer (false). Defaults to false.
   * @returns The Response or ArrayBuffer containing the image
   * @async
   */
  async renderIcon(returnRaw: true): Promise<Response>;
  async renderIcon(returnRaw = false): Promise<Response | ArrayBuffer> {
    return await UserCosmetics.prototype.renderIcon.call(
      {
        glow: 0,
        [this.icon.type]: this.icon.val,
        _creator: this._creator,
        colors: this.colors
      },
      this.icon.type,
      returnRaw
    );
  }
}

/**
 * Details about a Geometry Dash player returned from a search, without any stats
 */
class StatlessSearchedUser {
  /** The player's username  */
  username: string;
  /** The player's user ID. Will only be present if it is known */
  id?: number;
  /** The player's account ID */
  accountID: number;
  /** The player's cosmetics */
  cosmetics: SearchedUserCosmetics;

  /**
   * Creates a searched user
   * @param _creator The searched user's creator
   * @param rawData The raw data to parse
   */
  constructor(
    /** @internal */
    private _creator: UserCreator,
    rawData: string | ParsedData
  ) {
    const d = typeof rawData == 'string' ? parse(rawData, '~') : rawData;
    this.username = d[1];
    const id = +d[2];
    if (id) this.id = id;
    this.accountID = +d[16];
    this.cosmetics = new SearchedUserCosmetics(_creator, +d[9], ICONTYPEMAP[+d[14]], {
      primary: userColor(+d[10]),
      secondary: userColor(+d[11])
    });
  }

  /**
   * Get the most recent comment posted to this account's page
   * @returns The most recent comment
   * @async
   */
  async getAccountComments(): Promise<AccountComment<this>>;
  /**
   * Get the comments posted to this account's page
   * @param num The maximum number of comments to get
   * @returns An array of this user's profile comments
   * @async
   */
  async getAccountComments(num: number): Promise<AccountComment<this>[]>;
  async getAccountComments(num?: number): Promise<AccountComment<this> | AccountComment<this>[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const numToGet = Math.ceil(num / 10);
    const comments: AccountComment<this>[] = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        accountID: this.accountID,
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
      comments.push(...split.map(str => new AccountComment(this, str)));
      if (split.length < 10) break;
    }
    return singleReturn ? comments[0] || null : comments.slice(0, num);
  }

  /**
   * Gets the most recent or most liked level comment by the user
   * @param byLikes Whether to sort by likes or not. Defaults to false
   * @returns The most recent or most liked comment made by this user
   * @async
   */
  async getComments(byLikes?: boolean): Promise<LevelComment<this>>;
  /**
   * Gets the most recent or most liked level comments by the user
   * @param byLikes Whether to sort by likes or not. Defaults to false
   * @param num The number of comments to get
   * @returns An array of the most recent or most liked comments made by this user
   * @async
   */
  async getComments(byLikes: boolean, num: number): Promise<LevelComment<this>[]>;
  async getComments(
    byLikes = false,
    num?: number
  ): Promise<LevelComment<this> | LevelComment<this>[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const params = new GDRequestParams({
      count: num,
      userID: this.id,
      mode: +byLikes,
      page: 0,
      total: 0
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJCommentHistory.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return singleReturn ? null : [];
    const comments = data
      .slice(0, data.indexOf('#'))
      .split('|')
      .map(str => {
        const comment = str.slice(0, str.indexOf(':'));
        return new LevelComment(this._creator, this, comment);
      });
    return singleReturn ? comments[0] : comments;
  }

  /**
   * Gets the most recent level by the user
   * @returns The most recent level made by this user
   * @async
   */
  async getLevels(): Promise<this extends LoggedInUser ? LoggedInSearchedLevel : SearchedLevel>;
  /**
   * Gets the most recentlevels by the user
   * @param num The number of levels to get
   * @returns An array of the most recent levels made by this user
   * @async
   */
  async getLevels(
    num: number
  ): Promise<(this extends LoggedInUser ? LoggedInSearchedLevel : SearchedLevel)[]>;
  async getLevels(num?: number): Promise<SearchedLevel | SearchedLevel[]> {
    return this._creator._client.levels.byCreator(this, {}, num);
  }

  /**
   * Converts the searched user into a full user
   * @returns The full data about the user
   * @async
   */
  async resolve(): Promise<User> {
    return await this._creator.get(this.accountID);
  }
}

/**
 * Details about a Geometry Dash player returned from a search
 */
class SearchedUser extends StatlessSearchedUser {
  /** The player's user ID */
  id: number;
  /** The player's stats */
  stats: {
    /** The number of stars the player has collected */
    stars: number;
    /** The number of demons the player has beaten */
    demons: number;
    /** The coins the player has collected */
    coins: {
      /** The number of coins in the single-player mode (gold coins) the player has collected */
      normal: number;
      /** The number of coins in user-created levels (silver coins) the player has collected */
      user: number;
    };
    /** The number of creator points the player has earned */
    cp: number;
  };

  /**
   * Creates a searched user with stats
   * @param _creator The searched user's raw data
   * @param rawData The raw data to parse
   */
  constructor(_creator: UserCreator, rawData: string) {
    const d = parse(rawData); // Inefficient, yes, but easier
    super(_creator, d);
    this.stats = {
      stars: +d[3],
      demons: +d[4],
      coins: {
        normal: +d[13],
        user: +d[17]
      },
      cp: +d[8]
    };
  }
}

/**
 * Credentials provided by a user
 */
export type UserCredentials = {
  /** The player's username */
  username: string;
  /** The player's password */
  password: string;
};

/**
 * A creator for Geometry Dash players
 */
class UserCreator extends Creator {
  /**
   * Find a player by accountID or username
   * @param id The account ID or username of the player to get
   * @returns The player with the provided account ID or username
   * @async
   */
  async get(id: number | string | StatlessSearchedUser | User): Promise<User> {
    switch (typeof id) {
      case 'number':
        return await this.getByAccountID(id);
      case 'string':
        return await this.getByUsername(id);
      case 'object': {
        if (id instanceof StatlessSearchedUser || id instanceof User)
          return await this.getByAccountID(id.accountID);
      }
      default:
        return null;
    }
  }

  /**
   * Gets the information about a player using its account ID
   * @param id The account ID of the player to get
   * @returns The player with the provided account ID
   * @async
   */
  async getByAccountID(id: number): Promise<User> {
    const params = new GDRequestParams({
      targetAccountID: id
    });
    params.authorize('db');
    const data = await this._client.req('/getGJUserInfo20.php', { method: 'POST', body: params });
    if (data === '-1') return null;
    return new User(this, data);
  }

  /**
   * Searches for a player with a given string in their names.
   * Note that the official Geometry Dash servers will always only return the player (if any) whose name is exactly the provided string.
   * @param str The string to search for
   * @returns The first user whose name matches the given string
   * @async
   * @deprecated
   */
  async search(str: string): Promise<SearchedUser>;
  /**
   * Searches for players with a given string in their names.
   * Note that the official Geometry Dash servers will always only return the player (if any) whose name is exactly the provided string.
   * @param str The string to search for
   * @param num The maximum number of users to get
   * @returns The array of users whose names match the given string
   * @async
   * @deprecated
   */
  async search(str: string, num: number): Promise<SearchedUser[]>;
  async search(str: string, num?: number): Promise<SearchedUser | SearchedUser[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const numToGet = Math.ceil(num / 10);
    const searchedUsers: SearchedUser[] = [];
    for (let page = 0; page < numToGet; page++) {
      const params = new GDRequestParams({
        str,
        page,
        total: 0
      });
      params.authorize('db');
      const data = await this._client.req('/getGJUsers20.php', { method: 'POST', body: params });
      if (data === '-1') return singleReturn ? null : searchedUsers;
      const split = data.slice(0, data.indexOf('#')).split('|');
      searchedUsers.push(...split.map(str => new SearchedUser(this, str)));
      if (split.length < 10) break;
    }
    return singleReturn ? searchedUsers[0] || null : searchedUsers.slice(0, num);
  }

  /**
   * Get information about a user by its username
   * @param str The name of the user to search for
   * @param resolve Whether to resolve the searched user into its full user, making another network request.
   * @returns The user with the given username
   * @async
   */
  async getByUsername(str: string, resolve?: true): Promise<User>;
  /**
   * Get information about a user by its username
   * @param str The name of the user to search for
   * @param resolve Whether to resolve the searched user into its full user, making another network request.
   * @returns The user with the given username
   * @async
   */
  async getByUsername(str: string, resolve: false): Promise<SearchedUser>;
  async getByUsername(str: string, resolve = true): Promise<User | SearchedUser> {
    const possibleUser = await this.search(str);
    if (possibleUser && possibleUser.username.toLowerCase() === str.toLowerCase())
      return resolve ? possibleUser.resolve() : possibleUser;
    return null;
  }

  /**
   * Gets the top player of a user leaderboard
   * @param type The type of leaderboard to get
   * @returns The top player in the given leaderboard category
   * @async
   */
  async getLeaderboard(creators?: boolean): Promise<SearchedUser>;
  /**
   * Gets a user leaderboard
   * @param type The type of leaderboard to get
   * @param num The number of entries to get.
   * @returns The leaderboard, with position being index + 1
   * @async
   */
  async getLeaderboard(creators: boolean, num: number): Promise<SearchedUser[]>;
  async getLeaderboard(creators = false, num?: number): Promise<SearchedUser | SearchedUser[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const params = new GDRequestParams({
      count: num,
      type: creators ? 'creators' : 'top',
      page: 0,
      total: 0
    });
    params.authorize('db');
    const data = await this._client.req('/getGJScores20.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return singleReturn ? null : [];
    const leaders = data
      .slice(0, data.indexOf('#'))
      .split('|')
      .map(str => new SearchedUser(this, str));
    return singleReturn ? leaders[0] : leaders.slice(0, num);
  }

  /**
   * Log in to a Geometry Dash account
   * @param userCreds The username and password to log in with
   * @throws {TypeError} if credentials are invalid
   * @returns The logged in user associated with the provided credentials
   * @async
   */
  async login(userCreds: UserCredentials): Promise<LoggedInUser> {
    const params = new GDRequestParams();
    params.insertParams({
      userName: userCreds.username,
      password: userCreds.password,
      udid
    });
    params.authorize('account');
    const data = await this._client.req('/accounts/loginGJAccount.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') throw new TypeError('could not log in because the credentials were invalid');
    // TODO: What to do with userID (index 1)?
    const [accountIDStr] = data.split(',');
    return this.authorize({
      userName: userCreds.username,
      accountID: +accountIDStr,
      gjp: encrypt(userCreds.password, accountKey)
    });
  }

  /**
   * Log in to a Geometry Dash account using preprocessed credentials
   * @param creds The credentials to log in with
   * @throws {TypeError} if credentials are invalid
   * @returns The logged in user associated with the provided credentials
   * @async
   */
  async authorize(creds: Credentials): Promise<LoggedInUser> {
    const infoParams = new GDRequestParams({
      targetAccountID: creds.accountID
    });
    infoParams.authorize('db');
    const infoData = await this._client.req('/getGJUserInfo20.php', {
      method: 'POST',
      body: infoParams
    });
    if (infoData === '-1')
      throw new TypeError('could not log in because the credentials were invalid');
    return new LoggedInUser(this, infoData, creds);
  }
}

export {
  User,
  LoggedInUser,
  SearchedUser,
  StatlessSearchedUser,
  UserCreator,
  Comment,
  LevelComment,
  AccountComment,
  LoggedInAccountComment,
  LoggedInLevelComment,
  FriendRequest,
  IncomingFriendRequest,
  OutgoingFriendRequest,
  ConvertibleToAccountID,
  MessageUser,
  SearchedMessage,
  Message,
  GDColor,
  PermissionLevel,
  Permission,
  SocialURL,
  IconCosmetic,
  Colors,
  UserCosmetics,
  Socials,
  SearchedUserCosmetics
};
