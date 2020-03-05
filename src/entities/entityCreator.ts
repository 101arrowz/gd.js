/**
 * Entity creation base class
 * @internal
 * @packageDocumentation
 */
import Client from '..';

/**
 * A general type of entity creator
 */
class Creator {
  /**
   * The client to be accessed by the creator
   * @internal
   */
  _client: Client;

  /**
   * Creates an entity creator
   * @param client The client to register
   * @internal
   */
  constructor(client: Client) {
    this._client = client;
  }
}
export default Creator;
