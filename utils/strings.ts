import { stringify } from 'yaml';

export function errToString(e: any) {
  if (e instanceof String) {
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
