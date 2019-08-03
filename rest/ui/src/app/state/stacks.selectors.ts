import {createFeatureSelector, createSelector} from '@ngrx/store';
import {AppState} from './app-state';
import {StacksState} from './stacks.state';
import {collapseFrameworkCalls, collapseMethod, inSequence} from "../domain/stack-processing";
import {parseGoMethod} from "../domain/method";
import {Logger} from "../utils/logger";
import {fromStacks} from "../domain/graph-node";

const log = Logger.get("Stacks");

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

    const processed = log.doTimed("Apply stack processors",
      () => processor(stacks.all));

    return fromStacks(processed)
  });

export const selectHistogram = createSelector(
  selectFeature, state => state.histogram);
