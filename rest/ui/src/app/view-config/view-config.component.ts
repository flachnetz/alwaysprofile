import {Component} from '@angular/core';
import {GraphConfig, GroupingMode, StateService} from "../state.service";
import {Observable} from "rxjs";
import {Router} from "@angular/router";

@Component({
  selector: 'ViewConfig',
  templateUrl: './view-config.component.html',
  styleUrls: ['./view-config.component.scss']
})
export class ViewConfigComponent {
  public graphConfig$: Observable<GraphConfig>;

  constructor(
    private readonly router: Router,
    private readonly stateService: StateService) {

    this.graphConfig$ = stateService.projection(state => state.graphConfig);
  }

  public onGroupingModeChanged(value: GroupingMode) {
    this.publish({
      ...this.stateService.state.graphConfig,
      groupingMode: value,
    })
  }

  onCollapseRecursiveCallsChanged(value: boolean) {
    this.publish({
      ...this.stateService.state.graphConfig,
      collapseRecursiveCalls: value,
    })
  }

  private publish(graphConfig: GraphConfig) {
    this.router.navigate([], {
      queryParamsHandling: "merge",
      queryParams: {graphConfig: JSON.stringify(graphConfig)},
    });
  }
}
