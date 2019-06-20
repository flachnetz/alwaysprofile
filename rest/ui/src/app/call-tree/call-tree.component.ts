import {Component} from '@angular/core';
import {createSelector, Store} from '@ngrx/store';

import * as fromStacks from '../state/stacks.selectors';
import {AppState} from '../state/app-state';
import {Duration} from '../domain/duration';
import {Stack} from '../domain/stack';
import {Logger} from "../utils/logger";
import {Method} from "../domain/method";

const logger = Logger.get("CallTreeComponent");

@Component({
  selector: 'CallTreeComponent',
  templateUrl: './call-tree.component.html',
  styleUrls: ['./call-tree.component.scss']
})
export class CallTreeComponent {
  private transformer = (node: Call, level: number) => {
    return {
      call: node,
      expandable: !!node.next && node.next.length > 0,
      level: level,
    };
  };

  constructor(
    private readonly store: Store<AppState>) {

    this.store.select(stacksAsDataSource).subscribe(calls => console.log(calls));
  }

  public paddingOf(node: FlatCall): string {
    return node.level + "em";
  }
}

interface FlatCall {
  call: Call;
  expandable: boolean;
  level: number;
}

const stacksAsDataSource = createSelector(fromStacks.selectStacks, stacks => {
  const calls = logger.doTimed("Aggregate calls", () => calculateCalls(stacks.all, true));
  return calls.slice(0, 64);
});

class Call {
  constructor(
    readonly method: Method,
    readonly totalTime: Duration,
    readonly selfTime: Duration,

    public next: Call[] = []) {
  }

  public get selfTimeFraction(): number {
    return this.selfTime.millis / this.totalTime.millis;
  }

  public copy(): Call {
    return new Call(this.method, this.totalTime, this.selfTime,
      this.next);
  }
}


function calculateCalls(stacks: Stack[], reverse: boolean): Call[] {
  interface MethodInfo {
    selfTimeMs: number;
    totalTimeMs: number;
    parents: Set<Method>;
    children: Set<Method>
  }

  const methods = new Map<Method, MethodInfo>();

  for (const stack of stacks) {
    stack.methods.forEach((method, idx) => {
      let info = methods.get(method);
      if (info == null) {
        info = {selfTimeMs: 0, totalTimeMs: 0, parents: new Set(), children: new Set()};
        methods.set(method, info);
      }

      const child = stack.methods[idx + 1];
      if (child != null)
        info.parents.add(child);

      const parent = stack.methods[idx - 1];
      if (parent != null)
        info.children.add(parent);

      info.totalTimeMs += stack.duration.millis
    });

    // add top of the stack to self time
    const method = stack.methods[stack.methods.length - 1];
    methods.get(method)!.selfTimeMs += stack.duration.millis;
  }

  const calls = new Map<Method, Call>();
  methods.forEach((info, method) => {
    const call = new Call(method, new Duration(info.totalTimeMs), new Duration(info.selfTimeMs));
    calls.set(method, call);
  });

  if (reverse) {
    calls.forEach(call => {
      const parents = methods.get(call.method)!.parents;
      call.next = [...parents].map(parent => calls.get(parent)!);
    });

    const key = (call: Call) => {
      return call.next.length
    };

    return [...calls.values()].sort((lhs, rhs) => key(rhs) - key(lhs));

  } else {
    calls.forEach(call => {
      const children = methods.get(call.method)!.children;
      call.next = [...children].map(parent => calls.get(parent)!);
    });

    return [...calls.values()].filter(call => methods.get(call.method)!.children.size === 0);
  }
}
