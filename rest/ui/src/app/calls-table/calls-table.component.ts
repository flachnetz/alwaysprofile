import {Component, ViewChild} from '@angular/core';
import {MatPaginator, MatTableDataSource} from "@angular/material";
import {doTimed, Duration, IStack} from "../api-service.service";
import {createSelector, Store} from "@ngrx/store";

import * as fromService from '../state/services.selectors'
import {AppState} from "../state/app-state";
import {DataSource} from "@angular/cdk/table";
import {map} from "rxjs/operators";

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
  fromService.selectStacks,
  stacks => doTimed("Aggregate calls", () => calculateCalls(stacks)));

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


function calculateCalls(stacks: IStack[]): Call[] {
  const calls: { [key: string]: ICall } = {};

  for (const stack of stacks) {
    for (const method of stack.methods) {
      let call = calls[method.key];
      if (call == null) {
        calls[method.key] = call = {
          name: method.toString(),
          selfTime: Duration.ZERO,
          totalTime: Duration.ZERO,
        }
      }

      call.totalTime = call.totalTime.plus(stack.duration);
    }

    // add top of the stack to self time
    const method = stack.methods[stack.methods.length - 1];
    calls[method.key].selfTime = calls[method.key].selfTime.plus(stack.duration);
  }

  return Object.values(calls)
    .map(call => new Call(call))
    .sort((lhs, rhs) => rhs.selfTime.millis - lhs.selfTime.millis);
}
