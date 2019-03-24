import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatFormFieldModule, MatIconModule,
  MatMenuModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatRadioModule,
  MatSelectModule,
  MatTableModule,
  MatTabsModule,
  MatToolbarModule,
  MatTooltipModule,
  MatTreeModule,
} from '@angular/material';
import {ApiService} from './api-service.service';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FlameGraphComponent} from './flame-graph.component';
import {IntroComponent} from './intro/intro.component';
import {ViewConfigComponent} from './view-config/view-config.component';
import {GraphWrapperComponent} from './graph-wrapper/graph-wrapper.component';
import {RecreateDirective} from './recreate.directive';
import {CallsTableComponent} from './calls-table/calls-table.component';
import {StackLoaderComponent} from './stack-loader/stack-loader.component';
import {StoreModule} from '@ngrx/store';
import {servicesReducer} from './state/services.state';
import {EffectsModule} from '@ngrx/effects';
import {Effects} from './state/effects.service';
import {StoreDevtoolsModule} from '@ngrx/store-devtools';
import {environment} from '../environments/environment';
import {stacksReducer} from './state/stacks.state';
import {ServiceNavigationComponent} from './service-navigation/service-navigation.component';
import {CallTreeComponent} from "./call-tree/call-tree.component";

@NgModule({
  declarations: [
    AppComponent,
    FlameGraphComponent,
    IntroComponent,
    ViewConfigComponent,
    GraphWrapperComponent,

    RecreateDirective,

    CallsTableComponent,
    CallTreeComponent,

    StackLoaderComponent,

    ServiceNavigationComponent,
  ],
  imports: [
    AppRoutingModule,
    HttpClientModule,

    StoreModule.forRoot({
      stacks: stacksReducer as any,
      services: servicesReducer as any,
    }),

    EffectsModule.forRoot([
      Effects,
    ]),

    StoreDevtoolsModule.instrument({
      // Retains last 25 states
      maxAge: 25,

      // Restrict extension to log-only mode
      logOnly: environment.production,
    }),

    MatButtonModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatRadioModule,
    MatTableModule,
    MatMenuModule,
    MatTabsModule,
    MatTreeModule,
    MatIconModule,

    BrowserModule,
    BrowserAnimationsModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatPaginatorModule,
    MatTooltipModule,
  ],
  providers: [
    ApiService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
