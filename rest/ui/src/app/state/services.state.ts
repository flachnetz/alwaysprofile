import {Action} from "@ngrx/store";
import {IStack} from "../api-service.service";

export enum ActionTypes {
  LoadServices = 'LoadServices',
  Services = "Services",

  LoadService = "LoadService",
  Service = "Service",

  Reset = "Reset",
}

export class LoadServices implements Action {
  readonly type = ActionTypes.LoadServices;
}

export class Services implements Action {
  readonly type = ActionTypes.Services;

  constructor(public readonly services: Set<string>) {
  }
}

export class LoadService implements Action {
  readonly type = ActionTypes.LoadService;

  constructor(public readonly serviceId: string) {
  }
}

export class Service implements Action {
  readonly type = ActionTypes.Service;

  constructor(
    public readonly serviceId: string,
    public readonly stacks: IStack[]) {
  }
}


export class Reset implements Action {
  readonly type = ActionTypes.Reset;
}

export type ActionsUnion = LoadService | Service | LoadServices | Services | Reset;


export interface ServicesState {
  services: Set<string>;
  serviceId: string | null;

  stacks: IStack[];
  loading: boolean;
}

const initialState: ServicesState = {
  services: new Set<string>(),
  serviceId: null,
  stacks: [],
  loading: true,
};

export function serviceReducer(state = initialState, action: ActionsUnion): ServicesState {
  switch (action.type) {
    case ActionTypes.LoadService:
      return {
        ...state,
        stacks: [],
        loading: true,
        serviceId: action.serviceId,
        services: new Set([action.serviceId, ...state.services]),
      };

    case ActionTypes.Service:
      return {
        ...state,
        serviceId: action.serviceId,
        services: new Set([action.serviceId, ...state.services]),
        stacks: action.stacks,
        loading: false,
      };

    case ActionTypes.Services:
      return {
        ...state,
        services: new Set([...action.services, ...state.services]),
      };

    case ActionTypes.Reset:
      return {
        ...state,
        stacks: [],
        loading: false,
        serviceId: null
      };

    default:
      return state;
  }
};
