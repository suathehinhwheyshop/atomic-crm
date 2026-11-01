import { useQuery } from "@tanstack/react-query";

import { mergeDatasets, parseWorkbook } from "../model/parseWorkbook";
import type { BranchCode, Dataset, WorkbookSource } from "../model/types";
import { DEMO_TODAY, demoWorkbooks } from "./demoWorkbooks";

export const REFRESH_INTERVAL_MS = 60_000;

export type LoadedData = {
  dataset: Dataset;
  mode: "live" | "demo";
  connectedBranches: BranchCode[];
  today: string;
  fetchedAt: Date;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Live mode: the ops server (scripts/ops-server.mjs) reads the Google Sheets with the
 * service account and returns raw tab values. Without it, fall back to demo data.
 */
const loadData = async (): Promise<LoadedData> => {
  let response: Response | null = null;
  try {
    response = await fetch("api/workbooks", { cache: "no-store" });
  } catch {
    // No server at all (static demo hosting): use demo data below.
  }
  const isJson = response?.headers
    .get("content-type")
    ?.includes("application/json");
  if (response?.ok && isJson) {
    const sources = (await response.json()) as WorkbookSource[];
    return {
      dataset: mergeDatasets(sources.map(parseWorkbook)),
      mode: "live",
      connectedBranches: [...new Set(sources.map((s) => s.branch))],
      today: todayIso(),
      fetchedAt: new Date(),
    };
  }
  // The ops server answered with its own error: never hide it behind demo data.
  const body: unknown = isJson
    ? await response?.json().catch(() => null)
    : null;
  if (body && typeof body === "object" && "error" in body) {
    throw new Error(`Không đọc được Google Sheets: ${String(body.error)}`);
  }
  const sources = demoWorkbooks();
  return {
    dataset: mergeDatasets(sources.map(parseWorkbook)),
    mode: "demo",
    connectedBranches: ["HN"],
    today: DEMO_TODAY,
    fetchedAt: new Date(),
  };
};

export const useDataset = () =>
  useQuery({
    queryKey: ["workbooks"],
    queryFn: loadData,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
