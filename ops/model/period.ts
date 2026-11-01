import {
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
} from "date-fns";

export type Granularity = "week" | "month";

export type Period = { key: string; label: string; start: string };

const iso = (date: Date) => format(date, "yyyy-MM-dd");
const dm = (date: Date) => format(date, "dd/MM");

/** Period of an ISO date: week "2026-W43" (label "T43 · 20/10–26/10") or month "2026-10". */
export const periodOf = (date: string, granularity: Granularity): Period => {
  const parsed = parseISO(date);
  if (granularity === "month") {
    const [year, month] = date.split("-");
    return {
      key: `${year}-${month}`,
      label: `${month}/${year}`,
      start: `${year}-${month}-01`,
    };
  }
  const weekStart = startOfISOWeek(parsed);
  const week = String(getISOWeek(parsed)).padStart(2, "0");
  return {
    key: `${getISOWeekYear(parsed)}-W${week}`,
    label: `T${week} · ${dm(weekStart)}–${dm(addDays(weekStart, 6))}`,
    start: iso(weekStart),
  };
};

/** Distinct periods present in the dates, oldest first. */
export const periodsOf = (
  dates: string[],
  granularity: Granularity,
): Period[] => {
  const map = new Map<string, Period>();
  dates.forEach((d) => {
    const p = periodOf(d, granularity);
    map.set(p.key, p);
  });
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
};
