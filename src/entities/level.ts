import { inflate } from 'pako';
import {
  parse,
  generateDate,
  decrypt,
  gdDecodeBase64,
  levelKey,
  isNode,
  GDDate,
  ParsedData,
  GDRequestParams
} from '../util';
import { Song, DefaultSong } from './song';
import { Account } from './account';
import Creator from './entityCreator';

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

const DIFFICULTY_MAP: { [k in RawDifficulty]: Difficulty } = {
  [-1]: 'N/A',
  0: 'Auto',
  1: 'Easy',
  2: 'Normal',
  3: 'Hard',
  4: 'Harder',
  5: 'Insane'
};
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
 */
const getDifficulty = (diff: number, special?: 'auto' | 'demon'): DifficultyLevel => {
  const raw = (special === 'auto' ? 0 : diff === 0 ? -1 : diff / 10) as RawDifficulty;
  return {
    raw,
    pretty: special === 'demon' ? DEMON_DIFFICULTY_MAP[raw] : DIFFICULTY_MAP[raw]
  };
};

type PrettyAward = 'None' | 'Star' | 'Feature' | 'Epic';
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

const ORBS = [0, 0, 50, 75, 125, 175, 225, 275, 350, 425, 500];

/**
 * Gets the full award object from an award value
 * @param isRated Whether the level is rated
 * @param feature The position of the level feature
 * @param epic Whether the level is epic
 * @returns The award for the level
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
  song: Song | DefaultSong;
  /** The level's description */
  description: string;
  /** The level's creator. Will be a number representing the userID if the user is unregistered. */
  creator: Account | number;
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
  private _userData: string[];
  private _songData: ParsedData;

  /**
   * Creates info about a Geometry Dash level.
   * @param _creator The level's creator
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   */
  constructor(
    /** @internal */
    private _creator: LevelCreator,
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
        : new Song(_creator, (this._songData = songData.find(song => songID === song[1])));
    this.description = gdDecodeBase64(d[3]);
    const user = (this._userData = userData.find(el => el[0] === d[6]));
    if (!user) this.creator = +d[6];
    else {
      this.creator = new Account(this._creator._client.users, +user[2]);
    }
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
    if (orig !== 0) this.original = orig;
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
}

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
    /** The level's password. Will only be present if the level is copyable but not freely copyable. */
    password?: string;
  };
  /** The level's data */
  data: {
    /** The raw level string after decoding and decompressing. Only offered because `gd.js` is not primarily a level API, so this can be passed to your own manipulation program. */
    raw: string;
    /** The parsed level data */
    parsed: {
      /** The colors used in the level. Friendlier API is WIP. */
      colors: ParsedData[];
      /** The metadata of the level */
      meta: ParsedData;
      /** An array of objects in the level with numeric key-value pair representations. Each key has a different meaning. For example, 1 is ID, 2 is X position, and 3 is Y position. Friendlier parsing is a WIP. */
      objects: ParsedData[];
    };
  };

  /**
   * Creates information about a Geometry Dash level, including its string representation1
   * @param _creator The creator of the level
   * @param rawData The raw data to parse
   * @param userData The parsed user data
   * @param songData The parsed song data
   */
  constructor(_creator: LevelCreator, rawData: string, userData: string[], songData: ParsedData) {
    const d = parse(rawData.slice(0, rawData.indexOf('#')));
    super(_creator, d, [userData], [songData]);
    this.uploadedAt = generateDate(d[28]);
    this.updatedAt = generateDate(d[29]);
    const pass = decrypt(d[27], levelKey); // Working on GDPS support
    this.copy = {
      copyable: !['', '0'].includes(pass)
    };
    if (this.copy.copyable && pass !== '1')
      this.copy.password = (+pass.slice(1)).toString().padStart(4, '0');
    const raw = inflate(isNode ? Buffer.from(d[4], 'base64') : gdDecodeBase64(d[4]), {
      to: 'string'
    });
    const [header, ...parsedData] = raw.split(';').map(str => parse(str, ','));
    const colors = header.kS38
      .split('|')
      .slice(0, -1)
      .map(str => parse(str, '_'));
    delete header.kS38;
    this.data = {
      raw,
      parsed: {
        colors,
        meta: header,
        objects: parsedData
      }
    };
  }
}

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

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_MAP).map(v => +v);
const DEMON_DIFFICULTY_KEYS = Object.keys(DEMON_DIFFICULTY_MAP).map(v => +v);
const LENGTH_KEYS = Object.keys(LEVEL_LENGTH_MAP);

/**
 * Converts a difficulty to a numeric ID
 * @param diff The difficulty to parse
 * @param isDemon Whether the user asked for a demon
 * @returns The difficulty from the string difficulty and whether to default to demon or not
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
 * Convert a client-provided order into an integer
 * @param order The order to parse
 * @returns The integer order
 */
const orderToInt = (order: Order | OrderInt): OrderInt =>
  typeof order === 'number' ? order : ORDER_MAP[order];

/**
 * Gets the params for a certain award search
 * @param award The award to get
 * @returns The params to be inserted to match the given award request
 */
const awardToParams = (award: BaseSearchConfig['award']): { epic?: 1; featured?: 1 } => {
  if ([3, 'Epic', 'epic'].includes(award)) return { epic: 1, featured: 1 };
  if ([2, 'Feature', 'feature'].includes(award)) return { featured: 1 };
  return {};
};

/**
 * A creator for levels
 */
class LevelCreator extends Creator {
  /**
   * Gets a level by its ID
   * @param levelID The level ID to get
   * @returns The level with the given ID
   */
  async getByLevelID(levelID: number): Promise<Level> {
    return (await this.search({ query: levelID })).resolve();
  }

  /**
   * Search for levels with a query
   * @param config The query to use when searching for the level
   * @returns The level(s) that match the query
   * @async
   */
  async search(config: SearchConfig & { query: number | string }): Promise<SearchedLevel>;
  async search(config: SearchConfig & { query: number[] }): Promise<SearchedLevel[]>;
  async search(config: SearchConfig & { query: string }, num: number): Promise<SearchedLevel[]>;
  async search(
    {
      query = '',
      difficulty,
      orderBy = 0,
      demon,
      award,
      length,
      original = false,
      twoPlayer = false,
      coins = false
    }: SearchConfig,
    num?: number
  ): Promise<SearchedLevel | SearchedLevel[]> {
    let singleReturn = !num;
    if (singleReturn) num = 1;
    if (typeof query === 'number') {
      query = query.toString();
    } else if (query instanceof Array) {
      singleReturn = false;
      num = query.length;
      query = query.join(',');
    }
    const [diff, demonFilter] = diffToString(difficulty, demon);
    const len = lengthToString(length);
    const type = orderToInt(orderBy);
    const extraParams = awardToParams(award);
    const numToGet = Math.ceil(num / 10);
    const levels: SearchedLevel[] = [];
    for (let i = 0; i < numToGet; i++) {
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
export { SearchedLevel, LevelCreator };
