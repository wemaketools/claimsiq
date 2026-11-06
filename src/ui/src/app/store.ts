/**
 * The Redux store: session, data context and filters slices. `createAppStore` builds a fresh store (tests use it with a preloaded
 * state); `store` is the application's instance.
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { dataContextReducer } from './slices/dataContext';
import { filtersReducer } from './slices/filters';
import { sessionReducer } from './slices/session';

export const rootReducer = combineReducers({
  session: sessionReducer,
  dataContext: dataContextReducer,
  filters: filtersReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];

export const store = createAppStore();
