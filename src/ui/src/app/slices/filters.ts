/**
 * Filters slice: the filter and sort state of each screen, keyed by a stable screen id (for example `CLM-02`).
 * It resets when the user signs out or switches data set (the ids to filter by differ).
 */
import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { dataSetChanged } from './dataContext';
import { userBoundaryActions } from './session';

/** A JSON-serializable filter value. `null` means "no filter". */
export type FilterValue = string | number | boolean | string[] | null;
export type ScreenFilters = Record<string, FilterValue>;

export interface FiltersState {
  readonly byScreen: Record<string, ScreenFilters>;
}

const initialState: FiltersState = { byScreen: {} };

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    /** Merges values into a screen's filters. */
    filtersChanged(state, action: PayloadAction<{ screen: string; values: ScreenFilters }>) {
      const { screen, values } = action.payload;
      state.byScreen[screen] = { ...state.byScreen[screen], ...values };
    },
    /** Replaces a screen's filters (for example when a saved view is applied). */
    filtersReplaced(state, action: PayloadAction<{ screen: string; values: ScreenFilters }>) {
      state.byScreen[action.payload.screen] = action.payload.values;
    },
    filtersCleared(state, action: PayloadAction<{ screen: string }>) {
      delete state.byScreen[action.payload.screen];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(isAnyOf(...userBoundaryActions, dataSetChanged), () => initialState);
  },
});

export const { filtersChanged, filtersReplaced, filtersCleared } = filtersSlice.actions;
export const filtersReducer = filtersSlice.reducer;
