import {Stacks} from '../domain/stack';
import {Action} from '@ngrx/store';
import {Histogram} from "../domain/histogram";

export enum StacksActionTypes {
  LoadStacks = "LoadStacks",
  UpdateStacks = "UpdateStacks",
  UpdateHistogram = "UpdateHistogram",
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

export class UpdateHistogram implements Action {
  readonly type = StacksActionTypes.UpdateHistogram;

  constructor(
    public readonly serviceId: string,
    public readonly histogram: Histogram) {
  }
}

export type StacksActions = LoadStacks | UpdateStacks | UpdateHistogram;


export interface StacksState {
  serviceId: string | null;
  stacks: Stacks,
  loading: boolean,
  histogram: Histogram | null,
}

const initialState: StacksState = {
  serviceId: null,
  stacks: new Stacks(),
  loading: false,
  histogram: null,
};

export function stacksReducer(state = initialState, action: StacksActions): StacksState {
  switch (action.type) {
    case StacksActionTypes.LoadStacks:
      return {
        ...state,
        loading: true,
        stacks: new Stacks(),
        serviceId: action.serviceId,
        histogram: null,
      };

    case StacksActionTypes.UpdateStacks:
      return {
        ...state,
        loading: false,
        stacks: action.stacks,
        serviceId: action.serviceId,
      };

    case StacksActionTypes.UpdateHistogram:
      return {
        ...state,
        histogram: action.histogram,
      };

    default:
      return state;
  }
}
