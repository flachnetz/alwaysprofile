import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Store} from '@ngrx/store';
import {AppState} from './state/app-state';
import {LoadServices} from './state/services.state';
import * as fromServices from './state/services.selectors';
import * as fromStacks from './state/stacks.selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  public readonly serviceId$ = this.store.select(fromStacks.getSelectedServiceId);
  public readonly availableServices$ = this.store.select(fromServices.all);

  constructor(
    private readonly store: Store<AppState>,
    private readonly router: Router) {

    store.dispatch(new LoadServices());
  }

  public onServiceSelectChange(serviceId: string) {
    void this.router.navigate(["service", serviceId, "table"]);
  }
}
