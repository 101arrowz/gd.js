declare namespace NodeJS {
  interface Global {
    fetch: typeof import('node-fetch');
    atob: (str: string) => string;
    btoa: (str: string) => string;
  }
}
