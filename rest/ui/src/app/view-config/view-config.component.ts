import {Component} from '@angular/core';
import {EMPTY, Observable} from 'rxjs';
import {Router} from '@angular/router';
import {GraphConfig} from '../domain/graph-node';

@Component({
  selector: 'ViewConfig',
  templateUrl: './view-config.component.html',
  styleUrls: ['./view-config.component.scss']
})
export class ViewConfigComponent {
  public graphConfig$: Observable<GraphConfig> = EMPTY;

  constructor(
    private readonly router: Router) {

    // this.graphConfig$ = stateService.projection(state => state.graphConfig);
  }

  onCollapseRecursiveCallsChanged(value: boolean) {
    this.publish({
      collapseRecursiveCalls: value,
      collapseRuntimeCalls: false,
    })
  }

  private publish(graphConfig: GraphConfig) {
    this.router.navigate([], {
      queryParamsHandling: "merge",
      queryParams: {graphConfig: JSON.stringify(graphConfig)},
    });
  }
}
