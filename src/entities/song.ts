import { ParsedData } from '../util';
import { LevelCreator } from './level';

// TODO: Try to add things to SongAuthor (like get all songs by this author)

/**
 * Information about a song author
 */
class SongAuthor {
  constructor(
    /** The author's name */
    public name: string,
    /** The author's Newgrounds ID */
    public id: number
  ) {}
}

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
 * Information about a song
 */
class Song implements BaseSong {
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
  /** The song's Geometry Dash ID. Only exists if the song is a default song */
  gdID?: number;

  /**
   * Creates info about a song
   * @param _creator The associated level's creator
   * @param rawData The raw data to parse
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

export { Song, DefaultSong };
