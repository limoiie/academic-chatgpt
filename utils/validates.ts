import { RuleObject } from 'ant-design-vue/lib/form';

export function notInValidate<T>(set: T[] | null) {
  function validate(rule: RuleObject, value: T, callback: any) {
    const valid = !set?.includes(value);
    return valid ? Promise.resolve() : Promise.reject(rule.message || 'Already exists');
  }

  return validate;
}
