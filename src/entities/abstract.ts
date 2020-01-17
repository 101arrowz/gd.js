import Client from '..';

abstract class AbstractEntity {
  protected static client: Client;
  static setClient(newClient: Client): void {
    AbstractEntity.client = newClient;
  }
}
export default AbstractEntity;
