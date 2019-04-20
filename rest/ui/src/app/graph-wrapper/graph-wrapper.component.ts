import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ReplaySubject} from 'rxjs';
import {Store} from '@ngrx/store';
import {AppState} from '../state/app-state';

import * as fromStacks from "../state/stacks.selectors"

@Component({
  selector: 'GraphWrapper',
  templateUrl: './graph-wrapper.component.html',
  styleUrls: ['./graph-wrapper.component.scss']
})
export class GraphWrapperComponent implements OnDestroy {
  private readonly lifecycle$ = new ReplaySubject();

  public readonly flameGraph$ = this.store.select(fromStacks.selectNodes);

  constructor(
    private readonly store: Store<AppState>,
    private readonly route: ActivatedRoute) {

    // route.queryParamMap
    //   .pipe(
    //     map(params => params.get("graphConfig") || null),
    //     distinctUntilChanged(),
    //     map(config => config ? JSON.parse(config) : <GraphConfig>{
    //       collapseRecursiveCalls: false
    //     }),
    //     takeUntil(this.lifecycle$))
    //   .subscribe((graphConfig: GraphConfig) => stateService.updateGraphConfig(graphConfig));

    // const graphState = combineLatest(
    //   stateService.projection(state => state.stacks).pipe(filter(stacks => stacks != null)),
    //   stateService.projection(state => state.graphConfig));
    //
    // this.flameGraph$ = graphState.pipe(
    //   map(([stacks, graphConfig]) => {
    //     const processors: StackProcessor[] = [];
    //
    //     if (graphConfig.groupingMode === "package")
    //       processors.push(updateMethodGroupKey(method => method.module));
    //
    //     if (graphConfig.groupingMode === "type")
    //       processors.push(updateMethodGroupKey(method => method.module + "." + method.type));
    //
    //     if (graphConfig.collapseRecursiveCalls)
    //       processors.push(collapseRecursiveCalls());
    //
    //     return GraphNode.fromStacks(stacks!, processors);
    //   }),
    //
    //   takeUntil(this.lifecycle$));
  }

  public ngOnDestroy(): void {
    this.lifecycle$.next(true);
  }
}
