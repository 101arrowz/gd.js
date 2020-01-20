import GDParams from './param';
import { encrypt, accountKey } from './crypto';

/**
 * Credentials to use in requests to Geometry Dash servers
 */
export type Credentials = {
  /** The player's username */
  userName: string;
  /** The player's account ID */
  accountID: string;
  /** The player's password, XOR-encrypted with {@link accountKey} */
  gjp: string;
};
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
 * Logs in to the Geometry Dash servers.
 * @param creds The user-provided credentials to generate the final credentials from
 * @returns The credentials ready for use with the Geometry Dash servers
 */
export const login = async (creds: UserCredentials): Promise<Credentials> => {
  const params = new GDParams();
  params.insertParams({
    ...creds,
    udid: "Hi RobTop, it's gd.js!"
  });
  params.authorize('account');
  const data = await this.req('/accounts/loginGJAccount.php', {
    method: 'POST',
    body: params
  });
  // TODO: What to do with userID (index 1)?
  const [accountID] = data.split(',');
  const gjp = encrypt(creds.password, accountKey);
  return {
    userName: creds.username,
    accountID,
    gjp
  };
};
