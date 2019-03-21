'use strict';

const isArray = Array.isArray;
const keyList = Object.keys;
const hasProp = Object.prototype.hasOwnProperty;

export function deepEqual(a: any, b: any) {
  if (a === b)
    return true;

  if (typeof a === 'object' && typeof b === 'object') {
    if (hasEqualTo(a)) {
      return a.equalTo(b);
    }

    if (hasEqualTo(b)) {
      return b.equalTo(a);
    }

    if (a && b) {
      const arrA = isArray(a), arrB = isArray(b);

      if (arrA && arrB) {
        const length = a.length;
        if (length != b.length) return false;
        for (let i = length; i-- !== 0;) {
          if (!deepEqual(a[i], b[i])) {
            return false;
          }
        }

        return true;
      }

      if (arrA != arrB)
        return false;

      const keys = keyList(a);
      const length = keys.length;

      if (length !== keyList(b).length)
        return false;

      for (let i = length; i-- !== 0;)
        if (!hasProp.call(b, keys[i]))
          return false;

      for (let i = length; i-- !== 0;) {
        const key = keys[i];
        if (!deepEqual(a[key], b[key])) {
          return false;
        }
      }

      return true;
    }
  }

  return a !== a && b !== b;
}

interface EqualTo {
  equalTo(other: any): boolean;
}

function hasEqualTo(obj: any): obj is EqualTo {
  return obj != null && !!obj.equalTo
}
