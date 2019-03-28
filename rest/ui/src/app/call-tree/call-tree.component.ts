import {Component} from '@angular/core';
import {createSelector, Store} from '@ngrx/store';

import * as fromStacks from '../state/stacks.selectors';
import {AppState} from '../state/app-state';
import {Duration} from '../domain/duration';
import {Stack} from '../domain/stack';
import {Logger} from "../utils/logger";
import {NestedTreeControl} from "@angular/cdk/tree";
import {Method} from "../domain/method";
import {ArrayDataSource} from "@angular/cdk/collections";

const logger = Logger.get("CallTreeComponent");

@Component({
  selector: 'CallTreeComponent',
  templateUrl: './call-tree.component.html',
  styleUrls: ['./call-tree.component.scss']
})
export class CallTreeComponent {
  treeControl = new NestedTreeControl<Call>((call: Call) => {
    return call.callers;
  });

  dataSource$ = this.store.select(stacksAsDataSource);

  constructor(
    private readonly store: Store<AppState>) {
  }

  hasChild(_: number, node: Call) {
    return node.callers.length > 0;
  }
}

const stacksAsDataSource = createSelector(fromStacks.selectStacks, stacks => {
  const calls = logger.doTimed("Aggregate calls", () => calculateCalls(stacks.merged));
  return new ArrayDataSource(calls.slice(0, 64));
});

class Call {
  constructor(
    readonly method: Method,
    readonly totalTime: Duration,
    readonly selfTime: Duration,
    public callers: Call[] = []) {
  }

  public get selfTimeFraction(): number {
    return this.selfTime.millis / this.totalTime.millis;
  }

  public copy(): Call {
    return new Call(this.method, this.totalTime, this.selfTime,
      this.callers.map(call => call.copy()));
  }
}


function calculateCalls(stacks: Stack[]): Call[] {
  const selfTimes = new Map<Method, Duration>();
  const totalTimes = new Map<Method, Duration>();

  const methods = new Set<Method>();
  const parentsOf = new Map<Method, Set<Method>>();


  for (const stack of stacks) {
    stack.methods.forEach((method, idx) => {
      methods.add(method);

      if (idx > 0) {
        let parents = parentsOf.get(method);
        if (parents === undefined)
          parentsOf.set(method, parents = new Set());

        parents.add(stack.methods[idx - 1]);
      }

      totalTimes.set(method, (totalTimes.get(method) || Duration.ZERO).plus(stack.duration));
    });

    // add top of the stack to self time
    const method = stack.methods[stack.methods.length - 1];
    selfTimes.set(method, (selfTimes.get(method) || Duration.ZERO).plus(stack.duration));
  }

  const calls = new Map<Method, Call>();
  for (const method of methods) {
    const selfTime = selfTimes.get(method) || Duration.ZERO;
    calls.set(method, new Call(method, totalTimes.get(method)!, selfTime));
  }

  calls.forEach(call => {
    let parents = parentsOf.get(call.method) || [];
    call.callers = [...parents].map(parent => calls.get(parent)!.copy());
  });

  const key = (call: Call) => {
    return call.callers.length
  };

  // return [...calls.values()].sort((lhs, rhs) => rhs.selfTime.compareTo(lhs.selfTime));
  return [...calls.values()].sort((lhs, rhs) => key(rhs) - key(lhs));
}
