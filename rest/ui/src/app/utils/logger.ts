import {environment} from "../../environments/environment";
import {Stopwatch} from "../domain/duration";

export class Logger {
  constructor(private readonly name: string) {
  }

  public debug(...args: any) {
    if (environment.production)
      return;

    console.debug(`%c[DEBUG]%c${this.name}`, debugStyle, nameStyle, ...args)
  }

  public info(...args: any) {
    if (environment.production)
      return;

    console.info(`%c[INFO] %c${this.name}`, infoStyle, nameStyle, ...args)
  }

  public warn(...args: any) {
    console.warn(`%c[WARN] %c${this.name}`, warnStyle, nameStyle, ...args)
  }

  public error(...args: any) {
    console.error(`%c[ERROR] %c${this.name}`, errorStyle, nameStyle, ...args)
  }

  public doTimed<T>(action: string, fn: () => T): T {
    const watch = new Stopwatch();

    try {
      const result = fn();
      this.info(`${action} took ${watch}`);
      return result;

    } catch (err) {
      this.info(`${action} failed after ${watch}`);
      throw err;
    }
  }

  public static get(name: string): Logger {
    return new Logger(name);
  }
}

const debugStyle = "color:blue";
const infoStyle = "color:green";
const warnStyle = "color:orange";
const errorStyle = "color:red";

const nameStyle = "color:gray";
