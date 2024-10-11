export function removeDuplicate<T>(array: T[], key: keyof T) {
  return array.filter((v, i, a) => a.findIndex(t => (t[key] === v[key])) === i);
}
