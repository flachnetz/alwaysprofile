import {Component, OnDestroy} from '@angular/core';
import {
  collapseRecursiveCalls,
  GraphConfig,
  GraphNode,
  StackProcessor,
  StateService,
  updateMethodGroupKey
} from "../state.service";
import {ActivatedRoute} from "@angular/router";
import {distinctUntilChanged, filter, map, takeUntil} from "rxjs/operators";
import {combineLatest, Observable, ReplaySubject} from "rxjs";

@Component({
  selector: 'GraphWrapper',
  templateUrl: './graph-wrapper.component.html',
  styleUrls: ['./graph-wrapper.component.scss']
})
export class GraphWrapperComponent implements OnDestroy {
  private readonly lifecycle$ = new ReplaySubject();

  public readonly flameGraph$: Observable<GraphNode | null>;

  constructor(
    private readonly stateService: StateService,
    private readonly route: ActivatedRoute) {

    route.queryParamMap
      .pipe(
        map(params => params.get("graphConfig") || null),
        distinctUntilChanged(),
        map(config => config ? JSON.parse(config) : <GraphConfig>{
          groupingMode: "method",
          collapseRecursiveCalls: false
        }),
        takeUntil(this.lifecycle$))
      .subscribe((graphConfig: GraphConfig) => stateService.updateGraphConfig(graphConfig));

    const graphState = combineLatest(
      stateService.projection(state => state.stacks).pipe(filter(stacks => stacks != null)),
      stateService.projection(state => state.graphConfig));

    this.flameGraph$ = graphState.pipe(
      map(([stacks, graphConfig]) => {
        const processors: StackProcessor[] = [];

        if (graphConfig.groupingMode === "package")
          processors.push(updateMethodGroupKey(method => method.module));

        if (graphConfig.groupingMode === "type")
          processors.push(updateMethodGroupKey(method => method.module + "." + method.type));

        if (graphConfig.collapseRecursiveCalls)
          processors.push(collapseRecursiveCalls());

        return GraphNode.fromStacks(stacks!, processors);
      }),

      takeUntil(this.lifecycle$));
  }

  public ngOnDestroy(): void {
    this.lifecycle$.next(true);
  }
}
