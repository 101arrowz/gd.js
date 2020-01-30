import Creator from './entityCreator';
import { Account, LoggedInAccount } from './account';
import { parse, UserCredentials, GDRequestParams, accountKey, encrypt, Credentials } from '../util';
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
 */
const userColor = (colorValue: number): GDColor => ({
  raw: colorValue,
  parsed: colors[colorValue]
});

type PermissionLevel = 'User' | 'Moderator' | 'Elder Moderator';

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
 */
const generatePermission = (raw: number): Permission => ({
  raw: raw as Permission['raw'],
  pretty: PERMISSIONS[raw]
});

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
    const params = new URLSearchParams([
      ['form', type],
      ['icon', this[type].toString()],
      ['col1', this.colors.primary.raw.toString()],
      ['col2', this.colors.secondary.raw.toString()],
      ['glow', this.glow.toString()],
      ['noUser', '1']
    ]);
    const response = await this._creator._client.req(
      `https://gdbrowser.com/icon/gd.js?${params.toString()}`,
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
  /** The player's account */
  account: Account;
  /** The player's stats */
  stats: {
    /** The number of stars the player has collected */
    stars: number;
    /** The number of diamonds the player has collected */
    diamonds: number;
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
   */
  constructor(_creator: UserCreator, rawData: string) {
    const d = parse(rawData);
    this.username = d[1];
    this.id = +d[2];
    this.account = new Account(_creator, +d[16]);
    this.stats = {
      stars: +d[3],
      diamonds: +d[46],
      demons: +d[4],
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
}

/**
 * A logged-in Geometry Dash player
 */
class LoggedInUser extends User {
  account: LoggedInAccount;
  constructor(_creator: UserCreator, rawData: string, _creds: Credentials) {
    super(_creator, rawData);
    this.account = new LoggedInAccount(_creator, _creds);
  }
}

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
  constructor(icon: number, iconType: IconCosmetic, colors: Colors) {
    this.icon = {
      val: icon,
      type: iconType
    };
    this.colors = colors;
  }

  /**
   * Renders the user's selected default icon as an image using the GDBrowser API
   * @param returnRaw Whether to return a raw Response or an ArrayBuffer
   * @returns The Response or ArrayBuffer containing the image
   * @async
   */
  async renderIcon(returnRaw?: false): Promise<ArrayBuffer>;
  async renderIcon(returnRaw: true): Promise<Response>;
  async renderIcon(returnRaw = false): Promise<Response | ArrayBuffer> {
    return await UserCosmetics.prototype.renderIcon.call(
      {
        glow: 0,
        [this.icon.type]: this.icon.val,
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
  /** The player's user ID */
  id: number;
  /** The player's account */
  account: Account;
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
    rawData: string
  ) {
    const d = parse(rawData);
    this.username = d[1];
    this.id = +d[2];
    this.account = new Account(this._creator, +d[16]);
    this.cosmetics = new SearchedUserCosmetics(+d[9], ICONTYPEMAP[+d[14]], {
      primary: userColor(+d[10]),
      secondary: userColor(+d[11])
    });
  }

  /**
   * Converts the searched user into a full user
   * @returns The full data about the user
   * @async
   */
  async resolve(): Promise<User> {
    return await this._creator.get(this.account);
  }
}

/**
 * Details about a Geometry Dash player returned from a search
 */
class SearchedUser extends StatlessSearchedUser {
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
    super(_creator, rawData);
    const d = parse(rawData); // Inefficient, yes, but easier
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
 * A creator for Geometry Dash players
 */
class UserCreator extends Creator {
  /**
   * Find a player by accountID or username
   * @param id The account ID or username of the player to get
   * @returns The player with the provided account ID or username
   * @async
   */
  async get(id: number | string | Account): Promise<User> {
    switch (typeof id) {
      case 'number':
        return await this.getByAccountID(id);
      case 'string':
        return await this.getByUsername(id);
      case 'object': {
        if (id instanceof Account) return await this.getByAccountID(id.id);
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
   * Searches for players with a given string in their names. Note that the official Geometry Dash servers will always only return the player (if any) whose name is exactly the provided string.
   * @param str The string to search for
   * @param num The maximum number of results to fetch. If not specified, a single player is returned rather than an array.
   * @returns The user or array of users whose names match the given string
   * @async
   * @deprecated
   */
  async search(str: string): Promise<SearchedUser>;
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
  async getByUsername(str: string, resolve: false): Promise<SearchedUser>;
  async getByUsername(str: string, resolve = true): Promise<User | SearchedUser> {
    const possibleUser = await this.search(str);
    if (possibleUser && possibleUser.username.toLowerCase() === str.toLowerCase())
      return resolve ? possibleUser.resolve() : possibleUser;
    return null;
  }

  /**
   * Log in to a Geometry Dash account
   * @param userCreds The username and password to log in with
   * @throws {TypeError} Credentials must be valid
   * @async
   */
  async login(userCreds: UserCredentials): Promise<LoggedInUser> {
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
    const accountID = +accountIDStr;
    const gjp = encrypt(userCreds.password, accountKey);
    const infoParams = new GDRequestParams({
      targetAccountID: accountID
    });
    infoParams.authorize('db');
    const infoData = await this._client.req('/getGJUserInfo20.php', {
      method: 'POST',
      body: infoParams
    });
    if (infoData === '-1') return null;
    return new LoggedInUser(this, infoData, {
      userName: userCreds.username,
      accountID,
      gjp
    });
  }
}

export { User, SearchedUser, StatlessSearchedUser, UserCreator };
