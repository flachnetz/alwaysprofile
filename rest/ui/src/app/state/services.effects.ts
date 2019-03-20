import {Injectable} from "@angular/core";
import {Actions, Effect, ofType} from "@ngrx/effects";
import {ApiService} from "../api-service.service";
import {ActionTypes, LoadService, Service, Services} from "./services.state";
import {catchError, map, switchMap} from "rxjs/operators";
import {EMPTY, from, of} from "rxjs";

@Injectable()
export class ServicesEffects {

  constructor(
    private readonly actions$: Actions,
    private apiService: ApiService) {

  }

  @Effect()
  loadServices$ = this.actions$.pipe(
    ofType(ActionTypes.LoadServices),
    switchMap(() => {
      return from(this.apiService.listServices()).pipe(
        map(services => new Services(new Set(services.services))),
        catchError(() => EMPTY));
    }));


  @Effect()
  loadService$ = this.actions$.pipe(
    ofType(ActionTypes.LoadService),
    switchMap((action: LoadService) => {
      return from(this.apiService.fetchStacks(action.serviceId)).pipe(
        map(stacks => new Service(action.serviceId, stacks)),
        catchError(() => EMPTY));
    }))

}
