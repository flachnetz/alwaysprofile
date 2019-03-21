import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ReplaySubject} from 'rxjs';
import {Store} from '@ngrx/store';
import {AppState} from '../state/app-state';
import * as fromStacks from '../state/stacks.selectors';
import {distinctUntilChanged, map, takeUntil} from 'rxjs/operators';
import {LoadStacks} from '../state/stacks.state';

@Component({
  selector: 'app-stack-loader',
  templateUrl: './stack-loader.component.html',
  styleUrls: ['./stack-loader.component.scss']
})
export class StackLoaderComponent implements OnDestroy {
  private readonly lifecycle$ = new ReplaySubject(1);

  public readonly loading$ = this.store.select(fromStacks.isLoading);

  constructor(
    private readonly store: Store<AppState>,
    route: ActivatedRoute) {

    route.paramMap
      .pipe(
        map(params => params.get("serviceId") as string),
        distinctUntilChanged(),
        takeUntil(this.lifecycle$))
      .subscribe(serviceId => this.store.dispatch(new LoadStacks(serviceId)));
  }

  public ngOnDestroy(): void {
    this.lifecycle$.next(true);
  }
}
