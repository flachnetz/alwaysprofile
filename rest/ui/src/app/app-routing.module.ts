import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {IntroComponent} from "./intro/intro.component";
import {GraphWrapperComponent} from "./graph-wrapper/graph-wrapper.component";
import {CallsTableComponent} from "./calls-table/calls-table.component";
import {StackLoaderComponent} from "./stack-loader/stack-loader.component";

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
