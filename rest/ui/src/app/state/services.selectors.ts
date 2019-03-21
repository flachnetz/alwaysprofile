import {createFeatureSelector, createSelector} from '@ngrx/store';
import {AppState} from './app-state';
import {ServicesState} from './services.state';

const selectFeature = createFeatureSelector<AppState, ServicesState>("services");

export const all = createSelector(
  selectFeature, state => state.services);
