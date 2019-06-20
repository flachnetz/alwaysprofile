import {Injectable} from '@angular/core';
import {Actions, Effect, ofType} from '@ngrx/effects';
import {ApiService} from '../api-service.service';
import {ServicesActionTypes, UpdateServices} from './services.state';
import {catchError, map, startWith, switchMap} from 'rxjs/operators';
import {EMPTY, from} from 'rxjs';
import {LoadStacks, StacksActionTypes, UpdateHistogram, UpdateStacks} from './stacks.state';
import {Stacks} from '../domain/stack';
import {Histogram} from "../domain/histogram";
import {Duration} from "../domain/duration";

@Injectable()
export class Effects {

  constructor(
    private readonly actions$: Actions,
    private apiService: ApiService) {
  }

  @Effect()
  loadServices$ = this.actions$.pipe(
    ofType(ServicesActionTypes.LoadServices),
    switchMap(() => {
      return from(this.apiService.listServices()).pipe(
        map(services => new UpdateServices(services.services || [])),
        catchError(() => EMPTY));
    }));

  @Effect()
  loadService$ = this.actions$.pipe(
    ofType(StacksActionTypes.LoadStacks),
    switchMap((action: LoadStacks) => {
      return from(this.apiService.fetchStacks(action.serviceId)).pipe(
        map(stacks => new UpdateStacks(action.serviceId, new Stacks(stacks))),
        startWith(UpdateServices.forOne(action.serviceId)),
        catchError(() => EMPTY));
    }));

  @Effect()
  loadServiceHistogram = this.actions$.pipe(
    ofType(StacksActionTypes.LoadStacks),
    switchMap((action: LoadStacks) => {
      return from(this.apiService.fetchHistogram(action.serviceId)).pipe(
        map(values => new UpdateHistogram(action.serviceId, Histogram.ofValues(Duration.ofMinutes(5), values))),
        catchError(() => EMPTY));
    }));
}
