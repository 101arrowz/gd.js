/**
 * Authentication info
 * @internal
 * @packageDocumentation
 */

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
 * Credentials provided by a user
 */
export type UserCredentials = {
  /** The player's username */
  username: string;
  /** The player's password */
  password: string;
};
