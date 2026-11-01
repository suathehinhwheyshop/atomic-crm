import { useMemo } from "react";

import { branchUnits, type BranchUnit } from "../model/reports";
import type { Dataset } from "../model/types";
import { useFilters } from "./FiltersContext";
import { useScopedData } from "./useScopedData";

/** Scoped dataset plus the branch units and period bounds the finance reports need. */
export const useReportScope = (): {
  scoped: Dataset | undefined;
  units: BranchUnit[];
  from: string;
  to: string;
  today: string;
} => {
  const { loaded, scoped } = useScopedData();
  const { filters } = useFilters();
  const units = useMemo(() => (scoped ? branchUnits(scoped) : []), [scoped]);
  return {
    scoped,
    units,
    from: filters.from,
    to: filters.to,
    today: loaded?.today ?? "",
  };
};
