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
