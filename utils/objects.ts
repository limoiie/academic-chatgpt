/**
 * Remove null/undefined property from given object recursively.
 * @param obj The object which may have none property.
 */
export function recCleanNoneProperty(obj: object): object {
  return Object.entries(obj)
    .map(([k, v]) => [k, v && typeof v === 'object' ? recCleanNoneProperty(v) : v])
    .reduce((a, [k, v]) => {
      if (v != null) {
        a[k] = v;
      }
      return a;
    }, {} as Record<string, any>);
}
