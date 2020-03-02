/**
 * The UDID (needed for certain requests)
 * @internal
 */
const udid = Math.random()
  .toString(36)
  .slice(2, 18);
/**
 * The UUID (needed for certain requests)
 * @internal
 */
const uuid = udid;

export { udid, uuid };
