import { workerData, parentPort } from 'worker_threads';
import inflate from './tiny-inflate';
parentPort.postMessage(inflate(workerData));