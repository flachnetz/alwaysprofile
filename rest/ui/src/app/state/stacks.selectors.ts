import {createFeatureSelector, createSelector} from '@ngrx/store';
import {AppState} from './app-state';
import {StacksState} from './stacks.state';
import {GraphNode} from '../domain/graph-node';

export const selectFeature = createFeatureSelector<AppState, StacksState>('stacks');

export const isLoading = createSelector(
  selectFeature, state => state.loading);

export const selectStacks = createSelector(
  selectFeature, state => state.stacks);

export const getSelectedServiceId = createSelector(
  selectFeature, state => state.serviceId);

export const selectNodes = createSelector(
  selectFeature, state => GraphNode.fromStacks(state.stacks.merged));

export const selectHistogram = createSelector(
  selectFeature, state => state.histogram);
