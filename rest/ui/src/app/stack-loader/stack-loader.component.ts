import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {distinctUntilChanged, map, observeOn, takeUntil} from "rxjs/operators";
import {StateService} from "../state.service";
import {asyncScheduler, Observable, ReplaySubject} from "rxjs";

@Component({
  selector: 'app-stack-loader',
  templateUrl: './stack-loader.component.html',
  styleUrls: ['./stack-loader.component.scss']
})
export class StackLoaderComponent implements OnDestroy {
  private readonly lifecycle$ = new ReplaySubject(1);

  public readonly loading$: Observable<boolean>;

  constructor(
    stateService: StateService,
    route: ActivatedRoute) {

    route.paramMap
      .pipe(
        map(params => params.get("serviceId") as string),
        distinctUntilChanged(),
        takeUntil(this.lifecycle$))
      .subscribe(serviceId => void stateService.changeServiceId(serviceId));

    this.loading$ = stateService.projection(state => state.stacksLoading);
  }

  public ngOnDestroy(): void {
    this.lifecycle$.next(true);
  }
}
