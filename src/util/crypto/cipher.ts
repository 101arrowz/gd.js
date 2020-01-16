const cipher = (str: string, key: string): string =>
  String.fromCodePoint(
    ...str.split('').map((char, i) => char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  );
const encrypt = (str: string, key: string): string =>
  btoa(cipher(str, key))
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
const decrypt = (str: string, key: string): string =>
  cipher(atob(str.replace(/_/g, '/').replace(/-/g, '+')), key);
export { cipher, encrypt, decrypt };
