import {Action} from '@ngrx/store';

export enum ServicesActionTypes {
  LoadServices = 'LoadServices',
  UpdateServices = 'UpdateServices',
}

export class LoadServices implements Action {
  readonly type = ServicesActionTypes.LoadServices;
}

export class UpdateServices implements Action {
  readonly type = ServicesActionTypes.UpdateServices;

  constructor(public readonly services: string[]) {
  }

  static forOne(serviceId: string): UpdateServices {
    return new UpdateServices([serviceId]);
  }
}

export type ServicesActions = LoadServices | UpdateServices;


export interface ServicesState {
  services: string[];
}

const initialState: ServicesState = {
  services: [],
};

export function servicesReducer(state = initialState, action: ServicesActions): ServicesState {
  // noinspection JSRedundantSwitchStatement
  switch (action.type) {
    case ServicesActionTypes.UpdateServices:
      const servicesSet = new Set([...action.services, ...state.services]);
      return {
        ...state,
        services: [...servicesSet].sort(),
      };

    default:
      return state;
  }
}
