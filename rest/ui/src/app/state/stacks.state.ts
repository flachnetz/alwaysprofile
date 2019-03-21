import {Stacks} from '../domain/stack';
import {Action} from '@ngrx/store';

export enum StacksActionTypes {
  LoadStacks = "LoadStacks",
  UpdateStacks = "UpdateStacks",
}

export class LoadStacks implements Action {
  readonly type = StacksActionTypes.LoadStacks;

  constructor(public readonly serviceId: string) {
  }
}

export class UpdateStacks implements Action {
  readonly type = StacksActionTypes.UpdateStacks;

  constructor(
    public readonly serviceId: string,
    public readonly stacks: Stacks) {
  }
}

export type StacksActions = LoadStacks | UpdateStacks;



export interface StacksState {
  serviceId: string | null;
  stacks: Stacks,
  loading: boolean,
}

const initialState: StacksState = {
  serviceId: null,
  stacks: new Stacks({}),
  loading: false,
};


export function stacksReducer(state = initialState, action: StacksActions): StacksState {
  switch (action.type) {
    case StacksActionTypes.LoadStacks:
      return {
        ...state,
        loading: true,
        stacks: new Stacks({}),
        serviceId: action.serviceId,
      };

    case StacksActionTypes.UpdateStacks:
      return {
        ...state,
        loading: false,
        stacks: action.stacks,
        serviceId: action.serviceId,
      };

    default:
      return state;
  }
}
