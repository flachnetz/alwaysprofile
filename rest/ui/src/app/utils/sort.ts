export function compareBy<T>(key: (value: T) => any): (lhs: T, rhs: T) => number {
  return (lhs: T, rhs: T): number => {
    const a = key(lhs);
    const b = key(rhs);

    if (a < b) {
      return -1;
    }

    if (a > b) {
      return 1;
    }

    return 0;
  }
}
