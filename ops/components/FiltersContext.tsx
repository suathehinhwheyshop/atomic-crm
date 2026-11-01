import { createContext, useContext, useState, type ReactNode } from "react";

import type { Filters } from "../model/metrics";

type FiltersState = {
  filters: Filters;
  setFilters: (update: Partial<Filters>) => void;
};

const FiltersContext = createContext<FiltersState | null>(null);

export const FiltersProvider = ({
  initial,
  children,
}: {
  initial: Filters;
  children: ReactNode;
}) => {
  const [filters, set] = useState(initial);
  const setFilters = (update: Partial<Filters>) =>
    set((current) => ({ ...current, ...update }));
  return (
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => {
  const value = useContext(FiltersContext);
  if (!value) throw new Error("useFilters must be used inside FiltersProvider");
  return value;
};
