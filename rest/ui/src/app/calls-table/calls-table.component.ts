import {Component, ViewChild} from '@angular/core';
import {MatPaginator, MatTableDataSource} from '@angular/material';
import {createSelector, Store} from '@ngrx/store';

import * as fromStacks from '../state/stacks.selectors';
import {AppState} from '../state/app-state';
import {DataSource} from '@angular/cdk/table';
import {map} from 'rxjs/operators';
import {Duration} from '../domain/duration';
import {Stack} from '../domain/stack';
import {Logger} from "../utils/logger";

const logger = Logger.get("CallsTableComponent");

@Component({
  selector: 'app-calls-table',
  templateUrl: './calls-table.component.html',
  styleUrls: ['./calls-table.component.scss']
})
export class CallsTableComponent {
  public readonly columnsToDisplay = ["selfTimeFraction", "selfTime", "totalTime", 'methodName'];

  public readonly dataSource$ = this.store.select(stacksAsDataSource).pipe(map(calls => this.createDataSource(calls)));

  @ViewChild("paginator")
  public paginator!: MatPaginator;

  constructor(
    private readonly store: Store<AppState>) {
  }

  private createDataSource(calls: Call[]): DataSource<Call> {
    const dataSource = new MatTableDataSource(calls);
    dataSource.paginator = this.paginator;
    return dataSource;
  }
}

const stacksAsDataSource = createSelector(
  fromStacks.selectStacks,
  stacks => logger.doTimed("Aggregate calls", () => calculateCalls(stacks.all)));

interface ICall {
  name: string;
  totalTime: Duration;
  selfTime: Duration;
}

class Call {
  public readonly name: string;
  public readonly totalTime: Duration;
  public readonly selfTime: Duration;

  constructor(call: ICall) {
    this.name = call.name;
    this.totalTime = call.totalTime;
    this.selfTime = call.selfTime;
  }

  public get selfTimeFraction(): number {
    return this.selfTime.millis / this.totalTime.millis;
  }
}


function calculateCalls(stacks: Stack[]): Call[] {
  const calls: { [key: number]: ICall } = {};

  for (const stack of stacks) {
    for (const method of stack.methods) {
      let call = calls[method.id];
      if (call == null) {
        calls[method.id] = call = {
          name: method.toString(),
          selfTime: Duration.ZERO,
          totalTime: Duration.ZERO,
        }
      }

      call.totalTime = call.totalTime.plus(stack.duration);
    }

    // add top of the stack to self time
    const method = stack.methods[stack.methods.length - 1];
    calls[method.id].selfTime = calls[method.id].selfTime.plus(stack.duration);
  }

  return Object.values(calls)
    .map(call => new Call(call))
    .sort((lhs, rhs) => rhs.selfTime.millis - lhs.selfTime.millis);
}
