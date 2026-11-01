import { useMemo } from "react";

import { useDataset, type LoadedData } from "../data/useDataset";
import { filterDataset } from "../model/metrics";
import type { Dataset } from "../model/types";
import { useFilters } from "./FiltersContext";

export const useScopedData = (): {
  loaded: LoadedData | undefined;
  scoped: Dataset | undefined;
} => {
  const { data: loaded } = useDataset();
  const { filters } = useFilters();
  const scoped = useMemo(
    () => (loaded ? filterDataset(loaded.dataset, filters) : undefined),
    [loaded, filters],
  );
  return { loaded, scoped };
};
