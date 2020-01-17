const SECRETS = {
  db: 'Wmfd2893gb7',
  account: 'Wmfv3899gc9',
  moderator: 'Wmfp3879gc3'
};
export type GDRequestData = { [k: string]: string | number };
export default class GDRequestParams {
  private data: GDRequestData;

  constructor(data: GDRequestData = {}) {
    this.data = {
      gdw: 0,
      gameVersion: 21,
      binaryVersion: 35,
      ...data
    };
  }

  insertParams(data: GDRequestData): GDRequestData {
    return Object.assign(this.data, data);
  }

  authorize(type: keyof typeof SECRETS = 'db'): GDRequestData {
    this.data.secret = SECRETS[type];
    return this.data;
  }

  login(user: string, key: string, mode?: 'unencrypted' | 'encrypted'): GDRequestData {
    if (mode === 'unencrypted') {
      this.data.userName = user;
      this.data.password = key;
    } else {
      this.data.accountID = user;
      this.data.gjp = key;
    }
    return this.data;
  }

  rawCopy(): GDRequestData {
    return { ...this.data };
  }

  copy(): GDRequestParams {
    return new GDRequestParams(this.rawCopy());
  }

  resolve(): URLSearchParams {
    return new URLSearchParams(
      Object.entries(this.data).map(([paramName, paramValue]) => [paramName, paramValue.toString()])
    );
  }
}
