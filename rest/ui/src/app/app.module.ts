import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {
  MatCardModule, MatCheckboxModule,
  MatFormFieldModule, MatPaginatorModule, MatProgressBarModule,
  MatProgressSpinnerModule,
  MatRadioModule,
  MatSelectModule, MatTableModule,
  MatToolbarModule, MatTooltipModule
} from '@angular/material';
import {ApiService} from './api-service.service';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FlameGraphComponent} from './flame-graph.component';
import {StateService} from "./state.service";
import {IntroComponent} from './intro/intro.component';
import {ViewConfigComponent} from './view-config/view-config.component';
import {GraphWrapperComponent} from './graph-wrapper/graph-wrapper.component';
import {RecreateDirective} from "./recreate.directive";
import { CallsTableComponent } from './calls-table/calls-table.component';
import { StackLoaderComponent } from './stack-loader/stack-loader.component';

@NgModule({
  declarations: [
    AppComponent,
    FlameGraphComponent,
    IntroComponent,
    ViewConfigComponent,
    GraphWrapperComponent,

    RecreateDirective,

    CallsTableComponent,

    StackLoaderComponent,
  ],
  imports: [
    AppRoutingModule,
    HttpClientModule,

    MatToolbarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatRadioModule,
    MatTableModule,

    BrowserModule,
    BrowserAnimationsModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatPaginatorModule,
    MatTooltipModule,
  ],
  providers: [
    ApiService,
    StateService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
