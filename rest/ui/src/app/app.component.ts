import {Component} from '@angular/core';
import {MatSelectChange} from '@angular/material';
import {Router} from "@angular/router";
import {Observable} from "rxjs";
import {Store} from "@ngrx/store";
import {AppState} from "./state/app-state";
import {LoadServices} from "./state/services.state";
import * as fromServices from "./state/services.selectors";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  public readonly serviceId$: Observable<string | null> = this.store.select(fromServices.getSelectedServiceId);
  public readonly availableServices$: Observable<string[]> = this.store.select(fromServices.listAll);

  constructor(
    private readonly store: Store<AppState>,
    private readonly router: Router) {

    store.dispatch(new LoadServices());
  }

  public onServiceSelectChange(event: MatSelectChange) {
    const selectedService = event.value as string;
    void this.router.navigate(["service", selectedService, "table"]);
  }
}
