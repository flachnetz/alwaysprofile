import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {IntroComponent} from "./intro/intro.component";
import {GraphWrapperComponent} from "./graph-wrapper/graph-wrapper.component";
import {CallsTableComponent} from "./calls-table/calls-table.component";
import {StackLoaderComponent} from "./stack-loader/stack-loader.component";
import {ServiceNavigationComponent} from "./service-navigation/service-navigation.component";

const routes: Routes = [
  {
    path: "",
    component: IntroComponent,
  },
  {
    path: "service/:serviceId",
    component: StackLoaderComponent,

    children: [
      {
        path: "",
        component: ServiceNavigationComponent,
        outlet: "navigation",
      },
      {
        path: "flamegraph",
        component: GraphWrapperComponent,
      },

      {
        path: "table",
        component: CallsTableComponent,
      }
    ]
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {useHash: true})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
