import {Component} from '@angular/core';
import {ApiService} from './api-service.service';
import {MatSelectChange} from '@angular/material';
import {ActivationStart, Router} from "@angular/router";
import {Observable} from "rxjs";
import {StateService} from "./state.service";
import {distinctUntilChanged, map, takeUntil} from "rxjs/operators";
import {filter} from "rxjs/internal/operators/filter";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  public readonly serviceId$: Observable<string | null>;
  public readonly availableServices$: Observable<string[]>;

  constructor(
    private readonly apiService: ApiService,
    private readonly stateService: StateService,
    private readonly router: Router) {

    this.serviceId$ = stateService.projection(
      state => state.serviceId);

    this.availableServices$ = stateService.projection(
      state => [...state.availableServices].sort());
  }

  public onServiceSelectChange(event: MatSelectChange) {
    const selectedService = event.value as string;
    void this.router.navigate(["service", selectedService, "table"]);
  }
}
