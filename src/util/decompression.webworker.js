/**
 * Decompression worker (if worker API is available)
 * @packageDocumentation
 */
/// <reference no-default-lib="true" />
/// <reference lib="webworker" />
/// <reference lib="es7" />
import inflate from 'tiny-inflate';
addEventListener('message', ev => {
  const decompressed = inflate(ev.data);
  postMessage(decompressed, [decompressed.buffer]);
});