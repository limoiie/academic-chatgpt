import { stringify } from 'yaml';

export function errToString(e: any) {
  if (typeof e === 'string') {
    return e;
  }
  if (e instanceof Error) {
    return e.toString();
  }
  if (e.hasOwnProperty('description')) {
    return `SqlError: ${e.description}`;
  }
  return stringify(e);
}

export function uniqueName(name: string, names: string[]) {
  if (!names.includes(name)) {
    return name;
  }
  let i = 1;
  while (names.includes(`${name}-${i}`)) {
    i++;
  }
  return `${name}-${i}`;
}

export function camelize(str: string) {
  return str
    .replace(/^\w|[A-Z]|\b\w/g, function (word) {
      return word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

export function briefName(name: string, maxLength: number = 0) {
  return camelize(name)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength || name.length);
}
