import AbstractEntity from './abstract';

import color from 'color';
import { serialize, GDRequestParams } from '../util';
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
type GDColor = {
  raw: number;
  parsed: color;
};
const userColor = (colorValue: number): GDColor => ({
  raw: colorValue,
  parsed: color(colors[colorValue])
});

const PERMISSIONS = ['User', 'Moderator', 'Elder Moderator'];

type Permission = {
  raw: keyof typeof PERMISSIONS;
  pretty: typeof PERMISSIONS[keyof typeof PERMISSIONS];
};

const generatePermission = (raw: number): Permission => ({
  raw: raw as 1 | 2 | 3,
  pretty: PERMISSIONS[raw]
});

const SOCIALMAP = {
  youtube: 'https://youtube.com/channel/',
  twitch: 'https://twitch.tv/',
  twitter: 'https://twitter.com/'
};

type SocialURL = {
  path: string;
  fullURL: string;
};
const generateSocial = (path: string, type: keyof typeof SOCIALMAP): SocialURL => ({
  path,
  fullURL: SOCIALMAP[type] + path
});
type IconCosmetic = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'spider' | 'robot';
type Colors = { readonly primary: GDColor; readonly secondary: GDColor };
class UserCosmetics {
  readonly explosion?: number;

  constructor(
    readonly cube: number,
    readonly ship: number,
    readonly ball: number,
    readonly ufo: number,
    readonly wave: number,
    readonly robot: number,
    readonly glow: number,
    readonly spider: number,
    explosion: number,
    readonly colors: Colors
  ) {
    if (explosion) this.explosion = explosion;
  }

  async renderIcon(type: IconCosmetic, returnRaw: false): Promise<ArrayBuffer>;
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
    const response = await fetch(`https://gdbrowser.com/icon/gd.js?${params.toString()}`);
    if (returnRaw) return response;
    return response.arrayBuffer();
  }
}

type Socials = {
  youtube?: SocialURL;
  twitter?: SocialURL;
  twitch?: SocialURL;
};

class User extends AbstractEntity {
  readonly username: string;
  readonly userID: number;
  readonly accountID: number;
  readonly stats: {
    readonly stars: number;
    readonly diamonds: number;
    readonly demons: number;
    readonly coins: {
      readonly normal: number;
      readonly user: number;
    };
    readonly cp: number;
  };
  readonly socials: Readonly<Socials>;
  readonly cosmetics: UserCosmetics;
  readonly permissions: Permission;

  constructor(rawData: string) {
    super();
    const d = serialize(rawData);
    this.username = d[1];
    this.userID = +d[2];
    this.accountID = +d[16];
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
  static async getByAccountID(id: number): Promise<User> {
    const params = new GDRequestParams({
      targetAccountID: id
    });
    params.authorize('db');
    return new User(
      await User.client.req('/getGJUserInfo20.php', { method: 'POST', body: params })
    );
  }

  static async search(str: string): Promise<SearchedUser>;
  static async search(str: string, num: number): Promise<SearchedUser[]>;
  static async search(str: string, num?: number): Promise<SearchedUser | SearchedUser[]> {
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
      const data = await User.client.req('/getGJUsers20.php', { method: 'POST', body: params });
      const split = data.slice(0, data.indexOf('#')).split('|');
      searchedUsers.push(...split.map(str => new SearchedUser(str)));
      if (data.length < 10) break;
    }
    return singleReturn ? searchedUsers[0] || null : searchedUsers.slice(0, num);
  }
}

const ICONTYPEMAP = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];

class SearchedUser {
  readonly username: string;
  readonly userID: number;
  readonly accountID: number;
  readonly stats: {
    readonly stars: number;
    readonly demons: number;
    readonly coins: {
      readonly normal: number;
      readonly user: number;
    };
    readonly cp: number;
  };
  readonly cosmetics: {
    readonly icon: {
      readonly val: number;
      readonly type: string;
    };
    readonly colors: Colors;
  };
  constructor(rawData: string) {
    const d = serialize(rawData);
    this.username = d[1];
    this.userID = +d[2];
    this.accountID = +d[16];
    this.stats = {
      stars: +d[3],
      demons: +d[4],
      coins: {
        normal: +d[13],
        user: +d[17]
      },
      cp: +d[8]
    };
    this.cosmetics = {
      icon: {
        val: +d[9],
        type: ICONTYPEMAP[+d[14]]
      },
      colors: {
        primary: userColor(+d[10]),
        secondary: userColor(+d[11])
      }
    };
  }
  async renderIcon(returnRaw: false): Promise<ArrayBuffer>;
  async renderIcon(returnRaw: true): Promise<Response>;
  async renderIcon(returnRaw = false): Promise<Response | ArrayBuffer> {
    return await UserCosmetics.prototype.renderIcon.call(
      {
        [this.cosmetics.icon.type]: this.cosmetics.icon.val,
        glow: 0,
        colors: this.cosmetics.colors
      },
      this.cosmetics.icon.type,
      returnRaw
    );
  }
  async resolve(): Promise<User> {
    return await User.getByAccountID(this.accountID);
  }
}
export default User;
