import {Component} from '@angular/core';
import {createSelector, Store} from '@ngrx/store';

import * as fromStacks from '../state/stacks.selectors';
import {AppState} from '../state/app-state';
import {Duration} from '../domain/duration';
import {Stack} from '../domain/stack';
import {Logger} from "../utils/logger";
import {FlatTreeControl} from "@angular/cdk/tree";
import {Method} from "../domain/method";
import {MatTreeFlatDataSource, MatTreeFlattener} from "@angular/material";

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
      expandable: !!node.callers && node.callers.length > 0,
      level: level,
    };
  };

  treeControl = new FlatTreeControl<FlatCall>(
    node => node.level, node => node.expandable);

  treeFlattener = new MatTreeFlattener(
    this.transformer,
    node => node.level,
    node => node.expandable,
    node => node.callers);

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private readonly store: Store<AppState>) {

    this.store.select(stacksAsDataSource).subscribe(calls => this.dataSource.data = calls);
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
  const calls = logger.doTimed("Aggregate calls", () => calculateCalls(stacks.merged));
  return calls.slice(0, 64);
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
      this.callers);
  }
}


function calculateCalls(stacks: Stack[]): Call[] {
  interface MethodInfo {
    selfTimeMs: number;
    totalTimeMs: number;
    parentOf: Set<Method>;
  }

  const methods = new Map<Method, MethodInfo>();

  for (const stack of stacks) {
    stack.methods.forEach((method, idx) => {
      let info = methods.get(method);
      if (info == null) {
        info = {selfTimeMs: 0, totalTimeMs: 0, parentOf: new Set()};
        methods.set(method, info);
      }

      if (idx > 0) {
        info.parentOf.add(stack.methods[idx - 1]);
      }

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

  calls.forEach(call => {
    const parents = methods.get(call.method)!.parentOf;
    call.callers = [...parents].map(parent => calls.get(parent)!);
  });

  const key = (call: Call) => {
    return call.callers.length
  };

  // return [...calls.values()].sort((lhs, rhs) => rhs.selfTime.compareTo(lhs.selfTime));
  return [...calls.values()].sort((lhs, rhs) => key(rhs) - key(lhs));
}
