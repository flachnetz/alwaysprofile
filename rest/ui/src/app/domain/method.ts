const methodCache: { [key: string]: Method } = {};

// unique id for each method key to speed up comparisons
let nextMethodId: number = 1;

export class Method {
  public readonly id = nextMethodId++;

  constructor(
    // unique method key
    public readonly fqn: string,
    // method module or package
    public readonly module: string,
    // the type or class name
    public readonly type: string,
    // the method name.
    public readonly name: string) {
  }

  public get fullType(): string {
    return this.module + '.' + this.type;
  }

  public compareTo(other: Method): number {
    return Math.sign(other.id - this.id);
  }

  public equalTo(other: Method | null): boolean {
    return this === other;
  }

  public toString(): string {
    return this.fqn;
  }

  public static ROOT: Method = new Method('ROOT', 'ROOT', 'ROOT', 'ROOT');
}

/**
 * compare two arrays of methods by their ids.
 */
export function methodsCompare(lhs: Method[], rhs: Method[]): number {
  for (let idx = 0; idx < lhs.length; idx++) {
    if (idx < rhs.length) {
      const cmp = Math.sign(lhs[idx].id - rhs[idx].id);
      if (cmp !== 0) {
        return cmp;
      }
    } else {
      return 1;
    }
  }

  if (lhs.length < rhs.length)
    return -1;

  return 0;
}

export function parseGoMethod(fqn: string): Method {
  function parse(method: string): Method {
    const parts = method.split('.', 3);

    if (parts.length === 1) {
      return new Method(method, 'runtime', '<root>', method);
    }

    if (parts.length === 2) {
      const [module, name] = parts;
      return new Method(method, module, '<root>', name);
    }

    // module.name.func2.*
    if (/^func[0-9]+$/.test(parts[2])) {
      const [module, name] = parts;
      return new Method(method, module, '<root>', name);
    }

    let [module, type, name] = parts;
    if (type[0] === '(' && type[1] === '*') {
      type = type.slice(2, type.length - 1);
    }

    return new Method(method, module, type, name);
  }

  // check in cache first
  const cached = methodCache[fqn];
  if (cached != null)
    return cached;

  // parse the fully qualified name
  const parsed = parse(fqn);
  methodCache[fqn] = parsed;
  return parsed;
}
