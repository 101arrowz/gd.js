declare module 'uzip' {
  function inflateRaw(data: Uint8Array): Uint8Array;
  function inflate(data: Uint8Array): Uint8Array;
}
