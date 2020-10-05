/**
 * Level utilities
 * @internal
 * @packageDocumentation
 */

import {
  parse,
  generateDate,
  decrypt,
  gdDecodeBase64,
  decompress,
  levelKey,
  GDDate,
  ParsedData,
  GDRequestParams
} from '../util';
import Creator from './entityCreator';
import { User, LevelComment, StatlessSearchedUser, LoggedInUser } from './user';

// TODO: Try to add things to SongAuthor (like get all songs by this author)

/**
 * Information about a song author
 */
class SongAuthor {
  /** @internal */
  constructor(
    /** The author's name */
    public name: string,
    /** The author's Newgrounds ID */
    public id: number
  ) {}
}

/** @internal */
const DEFAULT_SONGS: [string, string][] = [
  ['Stay Inside Me', 'OcularNebula'],
  ['Stereo Madness', 'ForeverBound'],
  ['Back on Track', 'DJVI'],
  ['Polargeist', 'Step'],
  ['Dry Out', 'DJVI'],
  ['Base After Base', 'DJVI'],
  ["Can't Let Go", 'DJVI'],
  ['Jumper', 'Waterflame'],
  ['Time Machine', 'Waterflame'],
  ['Cycles', 'DJVI'],
  ['xStep', 'DJVI'],
  ['Clutterfunk', 'Waterflame'],
  ['Theory of Everything', 'DJ-Nate'],
  ['Electroman Adventures', 'Waterflame'],
  ['Clubstep', 'DJ-Nate'],
  ['Electrodynamix', 'DJ-Nate'],
  ['Hexagon Force', 'Waterflame'],
  ['Blast Processing', 'Waterflame'],
  ['Theory of Everything 2', 'DJ-Nate'],
  ['Geometrical Dominator', 'Waterflame'],
  ['Deadlocked', 'F-777'],
  ['Fingerdash', 'MDK'],
  ['The Seven Seas', 'F-777'],
  ['Viking Arena', 'F-777'],
  ['Airborne Robots', 'F-777'],
  ['The Challenge', 'RobTop'],
  ['Payload', 'Dex Arson'],
  ['Beast Mode', 'Dex Arson'],
  ['Machina', 'Dex Arson'],
  ['Years', 'Dex Arson'],
  ['Frontlines', 'Dex Arson'],
  ['Space Pirates', 'Waterflame'],
  ['Striker', 'Waterflame'],
  ['Round 1', 'Dex Arson'],
  ['Embers', 'Dex Arson'],
  ['Monster Dance Off', 'F-777'],
  ['Press Start', 'MDK'],
  ['Nock Em', 'Bossfight'],
  ['Power Trip', 'Boom Kitty']
];

/**
 * Base definition for a song
 * @internal
 */
interface BaseSong {
  /** The name of the song */
  name: string;
  /** Whether or not the song is a custom song */
  isCustom: boolean;
}

/**
 * Information about a default song
 */
class DefaultSong implements BaseSong {
  name: string;
  /** The default song's Geometry Dash ID */
  id: number;
  /** The song author's name */
  authorName: string;
  isCustom: false = false;

  /**
   * Creates info about a song
   * @param _creator The associated level's creator
   * @param id The numeric ID of the song
   * @internal
   */
  constructor(private _creator: LevelCreator, id: number) {
    id += 1;
    const song = DEFAULT_SONGS[id];
    this.id = id;
    this.name = song[0];
    this.authorName = song[1];
  }
}

/**
 * Information about a custom song
 */
class CustomSong implements BaseSong {
  name: string;
  /** The song's Newgrounds ID */
  id: number;
  /** The song's author */
  author: SongAuthor;
  /** The size of the song */
  size: {
    /** The raw number of bytes in the song. Note this may not be completely accurate. */
    raw: number;
    /** The size of the song in a human-readable format */
    pretty: string;
  };
  /** The URL containing the raw audio file */
  url: string;
  isCustom: true = true;

  /**
   * Creates info about a song
   * @param _creator The associated level's creator
   * @param rawData The raw data to parse
   * @internal
   */
  constructor(private _creator: LevelCreator, d: ParsedData) {
    this.id = +d[1];
    this.name = d[2];
    this.author = new SongAuthor(d[4], +d[3]);
    this.size = {
      raw: Math.floor(+d[5] * 1048576),
      pretty: d[5] + ' MB'
    };
    this.url = decodeURIComponent(d[10]);
  }
}

type Song = BaseSong | CustomSong;

type Difficulty = 'N/A' | 'Auto' | 'Easy' | 'Normal' | 'Hard' | 'Harder' | 'Insane';
type DemonDifficulty =
  | 'Any'
  | 'Easy Demon'
  | 'Medium Demon'
  | 'Hard Demon'
  | 'Insane Demon'
  | 'Extreme Demon';
type RawDemonDifficulty = 0 | 1 | 2 | 3 | 4 | 5;
type RawDifficulty = -1 | RawDemonDifficulty;

/** @internal */
const DIFFICULTY_MAP: { [k in RawDifficulty]: Difficulty } = {
  [-1]: 'N/A',
  0: 'Auto',
  1: 'Easy',
  2: 'Normal',
  3: 'Hard',
  4: 'Harder',
  5: 'Insane'
};
/** @internal */
const DEMON_DIFFICULTY_MAP: { [k in RawDemonDifficulty]: DemonDifficulty } = {
  0: 'Any',
  1: 'Easy Demon',
  2: 'Medium Demon',
  3: 'Hard Demon',
  4: 'Insane Demon',
  5: 'Extreme Demon'
};

/** A level's difficulty */
type DifficultyLevel = {
  /**
   * The difficulty level as a number. -1 = N/A, 0 = Auto, 1 = Easy, 2 = Normal, 3 = Hard, 4 = Harder, 5 = Insane.
   * If demon (i.e. the number of stars is 10), 1 = Easy, 2 = Medium, 3 = Hard, 4 = Insane, 5 = Extreme
   */
  raw: RawDifficulty;
  /** The difficulty level as a pretty string */
  pretty: Difficulty | DemonDifficulty;
};

/**
 * Gets the difficulty data for a given difficulty number returned by the server
 * @param diff The difficulty of the level
 * @param special Whether the level is a demon or an auto (if it is either of those)
 * @returns The difficulty as a full object
 * @internal
 */
const getDifficulty = (diff: number, special?: 'auto' | 'demon'): DifficultyLevel => {
  const raw = (special === 'auto' ? 0 : diff === 0 ? -1 : diff / 10) as RawDifficulty;
  return {
    raw,
    pretty: special === 'demon' ? DEMON_DIFFICULTY_MAP[raw] : DIFFICULTY_MAP[raw]
  };
};

type PrettyAward = 'None' | 'Star' | 'Feature' | 'Epic';
/** @internal */
const AWARDS: PrettyAward[] = ['None', 'Star', 'Feature', 'Epic'];

/** A level's award */
type Award = {
  /**
   * The raw numeric representation of the award. 0 = none, 1 = star, 2 = feature, 3 = epic.
   * Note this is also the amount of creator points earned from the level
   */
  raw: 0 | 1 | 2 | 3;
  /** The level's position in the leaderboard. Note this will only exist if the  */
  position?: number;
  /** The pretty representation of the award */
  pretty: PrettyAward;
};

/** @internal */
const ORBS = [0, 0, 50, 75, 125, 175, 225, 275, 350, 425, 500];

/**
 * Gets the full award object from an award value
 * @param isRated Whether the level is rated
 * @param feature The position of the level feature
 * @param epic Whether the level is epic
 * @returns The award for the level
 * @internal
 */
const getAward = (isRated: boolean, feature: number, isEpic: boolean): Award => {
  if (feature > 0) {
    const raw = isEpic ? 3 : 2;
    return {
      raw,
      position: feature,
      pretty: AWARDS[raw]
    };
  }
  const raw = isRated ? 1 : 0;
  return {
    raw,
    pretty: AWARDS[raw]
  };
};

type RawLevelLength = 0 | 1 | 2 | 3 | 4;
type PrettyLevelLength = 'Tiny' | 'Short' | 'Medium' | 'Long' | 'XL';
/** @internal */
const LEVEL_LENGTH_MAP: { [k in RawLevelLength]: PrettyLevelLength } = {
  0: 'Tiny',
  1: 'Short',
  2: 'Medium',
  3: 'Long',
  4: 'XL'
};

/** The length of a level */
type LevelLength = {
  /** The raw numeric length */
  raw: RawLevelLength;
  /** The prettified length (as shown in the actual game) */
  pretty: PrettyLevelLength;
};

/**
 * Gets the length of a level
 * @param raw The raw length from the server
 * @returns The length of the level in object form
 * @internal
 */
const getLevelLength = (raw: number): LevelLength => ({
  raw: raw as RawLevelLength,
  pretty: LEVEL_LENGTH_MAP[raw]
});

/** A level's coins */
type Coins = {
  /** The number of coins in the level */
  count: 0 | 1 | 2 | 3;
  /** Whether the coins are silver coins or not. Only exists if the level has coins */
  areSilver?: boolean;
};

/**
 * Data about a level returned from a search
 */
class SearchedLevel {
  /** The name of the level */
  name: string;
  /** The level's ID */
  id: number;
  /** The level's version */
  version: number;
  /** The game version in which the level was built */
  gameVersion: number;
  /** The song the level uses */
  song: Song;
  /** The level's description */
  description: string;
  /** The level's creator */
  creator: {
    /** The creator's user ID. */
    id: number;
    /** The creator's account ID (if the user is registered) */
    accountID?: number;
  };
  /** The level's difficulty rating */
  difficulty: {
    /** The number of stars the level received. Will be 0 if it has no rating */
    stars: number;
    /** The difficulty level */
    level: DifficultyLevel;
    /** The number of stars the creator requested */
    requestedStars: number;
  };
  /** The level's statistics */
  stats: {
    /** The number of likes the level has received */
    likes: number;
    /** The number of downloads the level has received */
    downloads: number;
    /** The number of objects in the level */
    objects: number;
    /** The length of the level */
    length: LevelLength;
  };
  /** The level's coins */
  coins: Coins;
  /** The award the level has recieved */
  award: Award;
  /** The number of orbs the level gives */
  orbs: number;
  /** The number of diamonds the level gives */
  diamonds: number;
  /** The ID of the original level the level was copied from. Only exists if the level was copied */
  original?: number;
  /** @internal */
  protected _userData: string[];
  /** @internal */
  protected _songData: ParsedData;

  /**
   * Creates info about a Geometry Dash level.
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   * @internal
   */
  constructor(
    /** @internal */
    protected _creator: LevelCreator,
    rawData: string | ParsedData,
    userData: string[][],
    songData: ParsedData[]
  ) {
    const d = typeof rawData === 'string' ? parse(rawData) : rawData;
    this.name = d[2];
    this.id = +d[1];
    this.version = +d[5];
    this.gameVersion = +d[13];
    const songID = d[35];
    this.song =
      songID === '0'
        ? new DefaultSong(_creator, +d[12])
        : new CustomSong(_creator, (this._songData = songData.find(song => songID === song[1])));
    this.description = gdDecodeBase64(d[3]);
    const user = (this._userData = userData.find(el => el[0] === d[6]) || []);
    this.creator = {
      id: +d[6]
    };
    if (user.length) this.creator.accountID = +user[2];
    this.difficulty = {
      stars: +d[18],
      level: getDifficulty(+d[9], !!d[17] ? 'demon' : !!d[25] ? 'auto' : undefined),
      requestedStars: +d[39]
    };
    this.stats = {
      likes: +d[14],
      downloads: +d[10],
      objects: +d[45],
      length: getLevelLength(+d[15])
    };
    this.coins = {
      count: +d[37] as Coins['count']
    };
    if (this.coins.count > 0) this.coins.areSilver = !!+d[38];
    this.award = getAward(this.difficulty.stars > 0, +d[19], !!+d[42]);
    this.orbs = ORBS[this.difficulty.stars];
    this.diamonds = this.difficulty.stars < 2 ? 0 : this.difficulty.stars + 2;
    const orig = +d[30];
    if (orig) this.original = orig;
  }

  /**
   * Get the full level from its searched counterpart.
   * @returns The full level
   * @async
   */
  async resolve(): Promise<Level> {
    const params = new GDRequestParams({
      levelID: this.id,
      inc: 1,
      extras: 0
    });
    params.authorize('db');
    return new Level(
      this._creator,
      await this._creator._client.req('/downloadGJLevel22.php', { method: 'POST', body: params }),
      this._userData,
      this._songData
    );
  }

  /**
   * Gets the level's creator. Will only succeed if the creator is registered
   * @returns The creator if it was registered, otherwise null
   * @async
   */
  async getCreator(): Promise<User> {
    return this.creator.accountID
      ? await this._creator._client.users.getByAccountID(this.creator.id)
      : null;
  }

  /**
   * Gets the top comment on this level
   * @param byLikes Whether to sort by likes or not
   * @returns The most recent or most liked comment made on this level
   * @async
   */
  async getComments(byLikes?: boolean): Promise<LevelComment<StatlessSearchedUser>>;
  /**
   * Gets the comments on this level
   * @param byLikes Whether to sort by likes or not
   * @param num The number of comments to get
   * @returns The most recent or most liked comments made on this level
   * @async
   */
  async getComments(byLikes: boolean, num: number): Promise<LevelComment<StatlessSearchedUser>[]>;
  async getComments(
    byLikes = false,
    num?: number
  ): Promise<LevelComment<StatlessSearchedUser> | LevelComment<StatlessSearchedUser>[]> {
    let singleReturn = false;
    if (!num) {
      num = 1;
      singleReturn = true;
    }
    const params = new GDRequestParams({
      count: num,
      levelID: this.id,
      mode: +byLikes,
      page: 0,
      total: 0
    });
    params.authorize('db');
    const data = await this._creator._client.req('/getGJComments21.php', {
      method: 'POST',
      body: params
    });
    if (data === '-1') return singleReturn ? null : [];
    const comments = data
      .slice(0, data.indexOf('#'))
      .split('|')
      .map(str => {
        const [comment, user] = str.split(':');
        return new LevelComment(
          this._creator._client.users,
          new StatlessSearchedUser(this._creator._client.users, user),
          '1~' + this.id + '~' + comment
        );
      });
    return singleReturn ? comments[0] : comments;
  }
}

/** A level's raw data */
type LevelData = {
  /** The raw level string after decoding and decompressing. Only offered because `gd.js` is not primarily a level API, so this can be passed to your own manipulation program. */
  raw: string;
};

/** Full data for a level */
type FullLevelData = LevelData & {
  /** The parsed level data */
  parsed: {
    /** The metadata of the level */
    meta: ParsedData;
    /** An array of objects in the level with numeric key-value pair representations. Each key has a different meaning. For example, 1 is ID, 2 is X position, and 3 is Y position. Friendlier parsing is a WIP. */
    objects: ParsedData[];
  };
};

/**
 * Details about a level, including its full representation
 */
class Level extends SearchedLevel {
  /** The level's upload date */
  uploadedAt: GDDate;
  /** The level's update date */
  updatedAt: GDDate;
  /** The level's copying details */
  copy: {
    /** Whether the level can be copied */
    copyable: boolean;
    /** The level's password. Will only be present if the level is copyable and has a password set (i.e. won't be present if either not copyable or free copy) */
    password?: string;
  };
  /** The raw level string before decoding and decompressing. Only offered because `gd.js` is not primarily a level API, so this can be passed to your own manipulation program. */
  data: string;

  /**
   * Creates information about a Geometry Dash level, including its string representation
   * @param _creator The creator of the level
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   * @internal
   */
  constructor(_creator: LevelCreator, rawData: string, userData: string[], songData: ParsedData) {
    const d = parse(rawData.slice(0, rawData.indexOf('#')));
    super(_creator, d, [userData], [songData]);
    this.uploadedAt = generateDate(d[28]);
    this.updatedAt = generateDate(d[29]);
    if (d[27] === '0') {
      this.copy = { copyable: false };
    } else {
      this.copy = { copyable: true };
      if (d[27] !== '1')
        this.copy.password = (+decrypt(d[27], levelKey).slice(1)).toString().padStart(4, '0'); // Working on GDPS support
    }
    this.data = d[4];
  }

  /**
   * Decodes the level data
   * @param full Whether to also parse the string level data
   * @returns The level data, with a parsed attribute if a full decode was
   *          requested
   */
  async decodeData(full?: false): Promise<LevelData>;
  /**
   * Decodes the level data
   * @param full Whether to also parse the string level data
   * @returns The level data, with a parsed attribute if a full decode was
   *          requested
   */
  async decodeData(full: true): Promise<FullLevelData>;
  async decodeData(full: boolean): Promise<LevelData> {
    const raw = await decompress(this.data);
    if (full) {
      const [header, ...parsedData] = raw.split(';').map(str => parse(str, ','));
      return {
        raw,
        parsed: {
          meta: header,
          objects: parsedData
        }
      } as FullLevelData;
    }
    return { raw };
  }
}

/**
 * Details about a level returned from a search, created by a logged in user
 */
class LoggedInSearchedLevel extends SearchedLevel {
  creator: LoggedInUser;
  /**
   * Creates info about a Geometry Dash level from a logged in user.
   * @param creator The level creator
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   * @internal
   */
  constructor(
    /** @internal */
    _creator: LevelCreator,
    creator: LoggedInUser,
    rawData: string | ParsedData,
    userData: string[][],
    songData: ParsedData[]
  ) {
    super(_creator, rawData, userData, songData);
    this.creator = creator;
  }

  async getCreator(): Promise<LoggedInUser> {
    return this.creator;
  }

  async resolve(): Promise<LoggedInLevel> {
    const params = new GDRequestParams({
      levelID: this.id,
      inc: 1,
      extras: 0
    });
    params.authorize('db');
    return new LoggedInLevel(
      this._creator,
      this.creator,
      await this._creator._client.req('/downloadGJLevel22.php', { method: 'POST', body: params }),
      this._userData,
      this._songData
    );
  }

  /**
   * Updates the description of the level
   * @param desc The new description of the level
   * @returns Whether setting the new description succeeded
   */
  async updateDescription(desc: string): Promise<boolean> {
    const success = await this.creator.updateLevelDescription(this, desc);
    if (success) {
      this.description = desc;
    }
    return success;
  }

  // Update level func? need compression support
}

interface LoggedInLevel extends Omit<Level, keyof SearchedLevel> {
  /**
   * Prevent prettier from converting this to an interface
   * @internal
   */
  '': undefined;
}
class LoggedInLevel extends LoggedInSearchedLevel {
  /**
   * Creates info about a Geometry Dash level from a logged in user.
   * @param creator The level creator
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   * @internal
   */
  constructor(
    _creator: LevelCreator,
    creator: LoggedInUser,
    rawData: string,
    userData: string[],
    songData: ParsedData
  ) {
    const d = parse(rawData.slice(0, rawData.indexOf('#')));
    super(_creator, creator, rawData, [userData], [songData]);
    this.uploadedAt = generateDate(d[28]);
    this.updatedAt = generateDate(d[29]);
    if (d[27] === '0') {
      this.copy = { copyable: false };
    } else {
      this.copy = { copyable: true };
      if (d[27] !== '1')
        this.copy.password = (+decrypt(d[27], levelKey).slice(1)).toString().padStart(4, '0'); // Working on GDPS support
    }
    this.data = d[4];
  }
}

Object.defineProperty(
  LoggedInLevel.prototype,
  'decodeData',
  Object.getOwnPropertyDescriptor(Level.prototype, 'decodeData')
);

type Order =
  | 'likes'
  | 'downloads'
  | 'trending'
  | 'recent'
  | 'featured'
  | 'magic'
  | 'awarded'
  | 'hof';
type OrderInt = 0 | 1 | 3 | 4 | 6 | 7 | 11 | 16;
/** @internal */
const ORDER_MAP: { [k in Order]: OrderInt } = {
  likes: 0,
  downloads: 1,
  trending: 3,
  recent: 4,
  featured: 6,
  magic: 7,
  awarded: 11,
  hof: 16
};

/** A search configuration */
type BaseSearchConfig = {
  /** The search query string, number (for level ID) or array of numbers (for multiple level IDs) */
  query?: number | number[] | string;
  /**
   * Difficulty level of levels to get. -1 = N/A, 0 = Auto, 1 = Easy, 2 = Normal, 3 = Hard, 4 = Harder, 5 = Insane.
   * If searching for demons, 0 = Any, 1 = Easy, 2 = Medium, 3 = Hard, 4 = Insane, 5 = Extreme
   */
  difficulty?:
    | RawDifficulty
    | Difficulty
    | (RawDemonDifficulty | DemonDifficulty)[]
    | RawDemonDifficulty
    | DemonDifficulty;
  /** How to order the levels. Some values currently unsupported. Can pass either a sorting ID or its pretty name. Misconfiguration of this setting will yield no results. */
  orderBy?: Order | OrderInt;
  /** Whether the level to search for should be a demon. This will modify the behavior of the difficulty option. */
  demon?: boolean;
  /** The award to filter levels by. 2 = Feature, 3 = Epic. Can also pass string value. */
  award?: 2 | 3 | 'Feature' | 'Epic';
  /** The lengths of the levels to get. Can pass a length ID, its pretty name, or an array containing lengths to get. */
  length?: RawLevelLength | PrettyLevelLength | (RawLevelLength | PrettyLevelLength)[];
  /** Whether to only get original levels */
  original?: boolean;
  /** Whether to only get levels with two-player support */
  twoPlayer?: boolean;
  /** Whether to only get levels with coins */
  coins?: boolean;
};

type NonDemonDiffConfig = {
  difficulty?: RawDifficulty | Difficulty | (RawDemonDifficulty | DemonDifficulty)[];
  demon?: false;
};
type DemonDiffConfig = {
  difficulty?: RawDemonDifficulty | DemonDifficulty;
  demon: true;
};

type SearchConfig = BaseSearchConfig & (NonDemonDiffConfig | DemonDiffConfig);

/** @internal */
const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_MAP).map(v => +v);
/** @internal */
const DEMON_DIFFICULTY_KEYS = Object.keys(DEMON_DIFFICULTY_MAP).map(v => +v);
/** @internal */
const LENGTH_KEYS = Object.keys(LEVEL_LENGTH_MAP);

/**
 * Converts a difficulty to a numeric ID
 * @param diff The difficulty to parse
 * @param isDemon Whether the user asked for a demon
 * @returns The difficulty from the string difficulty and whether to default to demon or not
 * @internal
 */
const diffToString = (
  diff:
    | undefined
    | RawDifficulty
    | Difficulty
    | RawDemonDifficulty
    | DemonDifficulty
    | (RawDemonDifficulty | DemonDifficulty)[],
  isDemon: boolean | undefined
): [string, number?] => {
  if (!diff) return isDemon ? ['-2', 0] : ['-'];
  if (diff instanceof Array) {
    return isDemon
      ? ['-2', diff.length > 0 ? diffToString(diff[0], true)[1] : 0]
      : [diff.map(v => diffToString(v, true)[0]).join(',') || '-'];
  }
  if (isDemon === undefined)
    isDemon = typeof diff === 'string' && diff.toLowerCase().includes('demon');
  if (isDemon)
    return [
      '-2',
      typeof diff === 'number'
        ? diff
        : DEMON_DIFFICULTY_KEYS.find(
            id => DEMON_DIFFICULTY_MAP[id].toLowerCase() === (diff as string).toLowerCase()
          )
    ];
  if (typeof diff !== 'number')
    diff = DIFFICULTY_KEYS.find(
      id => DIFFICULTY_MAP[id].toLowerCase() === (diff as string).toLowerCase()
    ) as RawDifficulty;
  return [diff === -1 ? '0' : diff === 0 ? '-3' : diff.toString() || '-'];
};

/**
 * Converts a client length to a server-compatible length
 * @param len The length to parse
 * @returns A server-compatible length
 * @internal
 */
const lengthToString = (
  len: RawLevelLength | PrettyLevelLength | (RawLevelLength | PrettyLevelLength)[]
): string =>
  len
    ? len instanceof Array
      ? len.map(lengthToString).join(',')
      : typeof len === 'number'
      ? len.toString()
      : LENGTH_KEYS.find(id => LEVEL_LENGTH_MAP[id].toLowerCase() === len.toLowerCase()) || '-'
    : '-';

/**
 * Gets the params for a certain award search
 * @param award The award to get
 * @returns The params to be inserted to match the given award request
 * @internal
 */
const awardToParams = (award: BaseSearchConfig['award']): { epic?: 1; featured?: 1 } => {
  if ([3, 'Epic', 'epic'].includes(award)) return { epic: 1, featured: 1 };
  if ([2, 'Feature', 'feature'].includes(award)) return { featured: 1 };
  return {};
};

/**
 * Convert a client-provided order into an integer
 * @param order The order to parse
 * @returns The integer order
 * @internal
 */
const orderToInt = (order: Order | OrderInt): OrderInt =>
  typeof order === 'number' ? order : ORDER_MAP[order];

/**
 * Gets the search params for a given search config
 * @param config The config to get the params for
 * @returns The params that work with the config
 * @internal
 */
const getSearchParams = ({
  query = '',
  difficulty,
  orderBy = 0,
  demon,
  award,
  length,
  original = false,
  twoPlayer = false,
  coins = false
}: SearchConfig): GDRequestParams => {
  if (typeof query === 'number') {
    query = query.toString();
  } else if (query instanceof Array) {
    query = query.join(',');
  }
  const [diff, demonFilter] = diffToString(difficulty, demon);
  const len = lengthToString(length);
  const type = orderToInt(orderBy);
  const extraParams = awardToParams(award);
  const params = new GDRequestParams({
    str: query,
    diff,
    len,
    type,
    ...extraParams
  });
  if (demonFilter) params.insertParams({ demonFilter });
  if (original) params.insertParams({ original: 1 });
  if (twoPlayer) params.insertParams({ twoPlayer: 1 });
  if (coins) params.insertParams({ coins: 1 });
  params.authorize('db');
  return params;
};

/**
 * A creator for levels
 */
class LevelCreator extends Creator {
  /**
   * Gets a level
   * @param levelID The level name or ID to get
   * @param resolve Whether to get the full level or not. Will cause an extra request.
   * @returns The level with the given ID
   * @async
   */
  async get(levelID: string | number, resolve?: false): Promise<SearchedLevel>;
  /**
   * Gets a level
   * @param levelID The level name or ID to get
   * @param resolve Whether to get the full level or not. Will cause an extra request.
   * @returns The level with the given ID
   * @async
   */
  async get(levelID: string | number, resolve: true): Promise<Level>;
  async get(levelID: string | number, resolve = false): Promise<SearchedLevel | Level> {
    const level = await this.search({ query: levelID });
    return resolve ? await level.resolve() : level;
  }

  /**
   * Search for the by a logged in creator
   * @param creator The logged in creator to get the levels for
   * @param config The query to use when searching for the levels
   * @returns The levels by the provided creator
   * @async
   */
  async byCreator(
    creator: LoggedInUser,
    config?: Omit<SearchConfig, 'query' | 'orderBy'>
  ): Promise<LoggedInSearchedLevel>;
  /**
   * Search for levels by a logged in creator
   * @param creator The logged in creator to get the levels for
   * @param config The query to use when searching for the levels
   * @param num The number of results to get
   * @returns The levels by the provided creator
   * @async
   */
  async byCreator(
    creator: LoggedInUser,
    config: Omit<SearchConfig, 'query' | 'orderBy'>,
    num: number
  ): Promise<LoggedInSearchedLevel[]>;
  /**
   * Search for levels by a creator
   * @param creator The creator to get the levels for
   * @param config The query to use when searching for the levels
   * @param num The number of results to get
   * @returns The levels by the provided creator
   * @async
   */
  async byCreator(
    creator: StatlessSearchedUser | User | number,
    config?: Omit<SearchConfig, 'query' | 'orderBy'>
  ): Promise<SearchedLevel>;
  /**
   * Search for levels by a creator
   * @param creator The creator to get the levels for
   * @param config The query to use when searching for the levels
   * @param num The number of results to get
   * @returns The levels by the provided creator
   * @async
   */
  async byCreator(
    creator: StatlessSearchedUser | User | number,
    config: Omit<SearchConfig, 'query' | 'orderBy'>,
    num: number
  ): Promise<SearchedLevel[]>;
  async byCreator(
    creator: StatlessSearchedUser | User | number,
    config: Omit<SearchConfig, 'query' | 'orderBy'> = {},
    num?: number
  ): Promise<SearchedLevel | SearchedLevel[]> {
    const singleReturn = !num;
    if (singleReturn) num = 1;
    let id: StatlessSearchedUser | User | number = creator;
    if (typeof creator !== 'number') {
      id = creator.id;
    }
    const params = getSearchParams({
      query: '' + id,
      orderBy: 5 as OrderInt, // Special case
      ...config
    } as SearchConfig);
    const numToGet = Math.ceil(num / 10);
    const levels: SearchedLevel[] = [];
    for (let i = 0; i < numToGet; i++) {
      params.insertParams({
        page: i
      });
      const data = await this._client.req('/getGJLevels21.php', { method: 'POST', body: params });
      if (data === '-1') return singleReturn ? null : levels;
      const [levelString, userString, songString] = data.split('#');
      const parsedUsers = userString.split('|').map(str => str.split(':'));
      const parsedSongs = songString.split('~:~').map(str => parse(str, '~|~'));
      levels.push(
        ...levelString
          .split('|')
          .map(str =>
            creator instanceof LoggedInUser
              ? new LoggedInSearchedLevel(this, creator, str, parsedUsers, parsedSongs)
              : new SearchedLevel(this, str, parsedUsers, parsedSongs)
          )
      );
    }
    return singleReturn ? levels[0] : levels.slice(0, num);
  }

  /**
   * Search for a level with a query
   * @param config The query to use when searching for the level
   * @returns The level that matches the query
   * @async
   */
  async search(config: SearchConfig & { query: number | string }): Promise<SearchedLevel>;
  /**
   * Search for levels with their numeric IDs
   * @param config The IDs of levels to get
   * @returns The levels with the associated IDs
   * @async
   */
  async search(config: SearchConfig & { query: number[] }): Promise<SearchedLevel[]>;
  /**
   * Search for levels with a query
   * @param config The query to use when searching for the levels
   * @param num The number of results to get
   * @returns The levels that match the query
   * @async
   */
  async search(config: SearchConfig & { query: string }, num: number): Promise<SearchedLevel[]>;
  async search(config: SearchConfig, num?: number): Promise<SearchedLevel | SearchedLevel[]> {
    const singleReturn = !num;
    if (singleReturn) num = 1;
    const params = getSearchParams(config);
    const numToGet = Math.ceil(num / 10);
    const levels: SearchedLevel[] = [];
    for (let i = 0; i < numToGet; i++) {
      params.insertParams({
        page: i
      });
      const data = await this._client.req('/getGJLevels21.php', { method: 'POST', body: params });
      if (data === '-1') return singleReturn ? null : levels;
      const [levelString, userString, songString] = data.split('#');
      const parsedUsers = userString.split('|').map(str => str.split(':'));
      const parsedSongs = songString.split('~:~').map(str => parse(str, '~|~'));
      levels.push(
        ...levelString.split('|').map(str => new SearchedLevel(this, str, parsedUsers, parsedSongs))
      );
    }
    return singleReturn ? levels[0] : levels.slice(0, num);
  }
}
export {
  SearchedLevel,
  Level,
  LevelCreator,
  LoggedInLevel,
  LoggedInSearchedLevel,
  BaseSong,
  CustomSong,
  DefaultSong,
  Song
};
