export type SerializedData = { [k: string]: string };
export default (data: string): SerializedData => {
  const split = data.split(':');
  const obj: SerializedData = {};
  for (let i = 0; i < split.length; i += 2) {
    obj[split[i]] = split[i + 1];
  }
  return obj;
};
