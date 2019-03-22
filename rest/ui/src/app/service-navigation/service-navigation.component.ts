import {Component} from '@angular/core';
import {createSelector, Store} from "@ngrx/store";
import {AppState} from "../state/app-state";
import * as fromStacks from "../state/stacks.selectors";


@Component({
  selector: 'ServiceNavigation',
  templateUrl: './service-navigation.component.html',
  styleUrls: ['./service-navigation.component.scss']
})
export class ServiceNavigationComponent {
  readonly links$ = this.store.select(selectserviceNavigationLinks);

  constructor(private readonly store: Store<AppState>) {
  }
}

interface NavigationLink {
  link: string[];
  title: string;
}

const selectserviceNavigationLinks = createSelector(fromStacks.getSelectedServiceId, service => {
  return <NavigationLink[]>[
    {link: ["/service", service, "flamegraph"], title: "Flamegraph"},
    {link: ["/service", service, "table"], title: "Method table"}
  ];
});

