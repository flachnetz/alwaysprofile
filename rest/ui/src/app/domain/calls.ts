import {Method} from "./method";
import {Duration} from "./duration";
import {Stack} from "./stack";

export class Call {
  constructor(
    public readonly method: Method,
    public readonly totalTime: Duration,
    public readonly selfTime: Duration,
  ) {
  }
}

export function flattenToCalls(stacks: Stack[]): Call[] {
  interface CallInfo {
    method: Method,
    totalTimeInMillis: number,
    selfTimeInMillis: number,
  }

  const calls = new Map<Method, CallInfo>();

  for (const stack of stacks) {
    for (const method of stack.methods) {
      let call = calls.get(method);
      if (call == null) {
        call = {method, selfTimeInMillis: 0, totalTimeInMillis: 0};
        calls.set(method, call);
      }

      call.totalTimeInMillis += stack.duration.millis;
    }

    calls.get(stack.top)!.selfTimeInMillis += stack.duration.millis;
  }

  return [...calls.values()].map(c => {
    const selfTime = Duration.ofMillis(c.selfTimeInMillis);
    const totalTime = Duration.ofMillis(c.totalTimeInMillis);
    return new Call(c.method, totalTime, selfTime);
  });
}
