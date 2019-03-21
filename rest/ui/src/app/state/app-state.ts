import {ServicesState} from './services.state';
import {StacksState} from './stacks.state';

export interface AppState {
  services: ServicesState
  stacks: StacksState,
}


