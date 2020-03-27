import inflate from './tiny-inflate';
import isNode from './isNode';
import { gdDecodeBase64 } from './crypto';

/**
 * Decompresses data of an arbitrary type from the Geometry Dash servers
 * @param data The Base64, compressed data to decompress
 * @returns The source string data
 */
const decompress = async (data: string): Promise<string> => {
  const rawBytes = isNode
    ? Buffer.from(data, 'base64')
    : new Uint8Array(
        gdDecodeBase64(data)
          .split('')
          .map(str => str.charCodeAt(0))
      );
  let resultBytes: Uint8Array;
  if (typeof Worker !== 'undefined') {
    resultBytes = await new Promise((res, rej) => {
      if (isNode) {
        const NodeWorker = (Worker as unknown) as typeof import('worker_threads').Worker;
        const worker = new NodeWorker(require('path').join(__dirname, 'decompression.worker.js'), {
          workerData: rawBytes
        });
        worker.on('message', res);
        worker.on('error', rej);
        worker.on('exit', code => {
          if (code !== 0) rej();
        });
      } else {
        const worker = new Worker('./decompression.webworker.js');
        worker.addEventListener('message', ev => res(ev.data));
        worker.addEventListener('error', ev => rej(ev.error));
        worker.postMessage(rawBytes, [rawBytes.buffer]);
      }
    });
  } else {
    resultBytes = inflate(rawBytes);
  }
  let out = '';
  for (const byte of resultBytes) out += String.fromCharCode(byte);
  return out;
};

export default decompress;
