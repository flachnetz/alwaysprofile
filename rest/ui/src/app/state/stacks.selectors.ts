import {createFeatureSelector, createSelector} from '@ngrx/store';
import {AppState} from './app-state';
import {StacksState} from './stacks.state';
import {GraphNode} from '../domain/graph-node';
import {collapseFrameworkCalls, collapseMethod, inSequence} from "../domain/stack-processing";
import {parseGoMethod} from "../domain/method";

export const selectFeature = createFeatureSelector<AppState, StacksState>('stacks');

export const isLoading = createSelector(
  selectFeature, state => state.loading);

export const selectStacks = createSelector(
  selectFeature, state => state.stacks);

export const getSelectedServiceId = createSelector(
  selectFeature, state => state.serviceId);

export const selectNodes = createSelector(
  selectStacks, stacks => {
    const processor = inSequence([
      collapseMethod([parseGoMethod("runtime.newstack")]),
      collapseFrameworkCalls(["net.", "net/http."])]);

    return GraphNode.fromStacks(processor(stacks.merged))
  });

export const selectHistogram = createSelector(
  selectFeature, state => state.histogram);
