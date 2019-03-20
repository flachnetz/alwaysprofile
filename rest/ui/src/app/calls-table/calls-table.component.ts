import {Component, ViewChild} from '@angular/core';
import {MatPaginator, MatTableDataSource} from "@angular/material";
import {doTimed, Duration, IStack} from "../api-service.service";
import {StateService} from "../state.service";
import {filter, map} from "rxjs/operators";
import {Observable} from "rxjs";

@Component({
  selector: 'app-calls-table',
  templateUrl: './calls-table.component.html',
  styleUrls: ['./calls-table.component.scss']
})
export class CallsTableComponent {
  public readonly columnsToDisplay = ["selfTimeFraction", "selfTime", "totalTime", 'methodName'];
  public readonly dataSource$: Observable<MatTableDataSource<Call>>;

  @ViewChild("paginator")
  public paginator!: MatPaginator;

  constructor(
    private readonly stateService: StateService) {

    this.dataSource$ = stateService.projection(state => state.stacks)
      .pipe(
        filter(stacks => stacks != null),
        map(stacks => doTimed("Aggregate calls", () => calculateCalls(stacks!))),
        map(calls => this.toDataStore(calls)));
  }

  private toDataStore(calls: Call[]) {
    const dataStore = new MatTableDataSource(calls);
    dataStore.paginator = this.paginator;
    return dataStore;
  }
}

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
