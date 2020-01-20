import Client from '..';

/**
 * A general type of entity finder
 */
class Finder {
  /**
   * The client to be accessed by the finder
   * @internal
   */
  _client: Client;

  /**
   * Creates an entity finder
   * @param client The client to register
   */
  constructor(client: Client) {
    this._client = client;
  }
}
export default Finder;
