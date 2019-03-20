import {createFeatureSelector, createSelector} from "@ngrx/store";
import {AppState} from "./app-state";
import {ServicesState} from "./services.state";

const selectFeature = createFeatureSelector<AppState, ServicesState>("service");


export const isLoading = createSelector(
  selectFeature, state => state.loading);

export const selectStacks = createSelector(
  selectFeature, state => state.stacks);

export const getSelectedServiceId = createSelector(
  selectFeature, state => state.serviceId);

export const listAll = createSelector(
  selectFeature, state => [...state.services].sort());
