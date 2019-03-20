import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable()
export class ApiService {
  constructor(private readonly httpClient: HttpClient) {
  }

  public async listServices(): Promise<IServices> {
    return await this.httpClient
      .get<IServices>(`/api/v1/services`)
      .toPromise();
  }

  public async fetchStacks(service: string): Promise<IStack[]> {
    const response = await this.httpClient
      .get<IStackResponse[]>(`/api/v1/services/${encodeURIComponent(service)}/stack`)
      .toPromise();

    return response.map(stack => {
      return <IStack>{
        methods: stack.methods.map(method => Method.parseGo(method)),
        duration: new Duration(stack.durationInMillis),
      };
    });
  }

}

export interface IServices {
  services: string[];
}

export interface IStack {
  methods: Method[];
  duration: Duration;
}

interface IStackResponse {
  methods: string[];
  durationInMillis: number;
}


export class Duration {
  constructor(readonly millis: number) {
  }

  public get seconds(): number {
    return 0.001 * this.millis;
  }

  public get micros(): number {
    return 1000 * this.millis;
  }

  public toString(): string {
    if (this.millis >= 1_000) {
      return this.seconds.toFixed(2) + "s"
    }

    if (this.millis >= 1) {
      return this.seconds.toFixed(2) + "ms"
    }

    return this.micros.toFixed(2) + "µs";
  }

  public plus(other: Duration): Duration {
    return new Duration(this.millis + other.millis)
  }

  public minus(other: Duration): Duration {
    return new Duration(this.millis - other.millis);
  }

  public static readonly ZERO = new Duration(0);

  public static since(startTime: number) {
    return new Duration(Date.now() - startTime);
  }
}

export function doTimed<T>(action: string, fn: () => T): T {
  console.time(action);
  try {
    return fn();
  } finally {
    console.timeEnd(action);
  }
}

let nextMethodId: number = 1;
const methodCache: { [key: string]: Method } = {};

export class Method {
  public readonly id = nextMethodId++;

  constructor(
    public readonly key: string,
    public readonly module: string,
    public readonly type: string,
    public readonly name: string) {
  }

  public static parseGo(method: string) {
    function parse(method: string): Method {
      const parts = method.split(".", 3);

      if (parts.length === 1) {
        return new Method(method, "runtime", "<root>", method);
      }

      if (parts.length === 2) {
        const [module, name] = parts;
        return new Method(method, module, "<root>", name);
      }

      // module.name.func2.*
      if (/^func[0-9]+$/.test(parts[2])) {
        const [module, name] = parts;
        return new Method(method, module, "<root>", name);
      }

      let [module, type, name] = parts;
      if (type[0] === '(' && type[1] === '*') {
        type = type.slice(2, type.length - 1);
      }

      return new Method(method, module, type, name);
    }

    const cached = methodCache[method];
    if (cached != null)
      return cached;

    const parsed = parse(method);
    methodCache[method] = parsed;
    return parsed;
  }

  public withKey(key: string): Method {
    const cached = methodCache[key];
    if (cached != null)
      return cached;

    const method = new Method(key, this.module, this.type, this.name);
    methodCache[key] = method;
    return method;
  }

  public compareTo(other: Method): number {
    return this.id - other.id;
  }

  public toString(): string {
    return this.key;
  }

  public static ROOT: Method = new Method("ROOT", "ROOT", "ROOT", "ROOT");
}
