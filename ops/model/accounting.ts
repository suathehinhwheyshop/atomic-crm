// Views over the BCTC tabs: monthly P&L per unit, key lines across units,
// supplier payment schedule and stock summaries.
import type { BranchUnit } from "./reports";
import { unitKey } from "./reports";
import type {
  Dataset,
  PaymentSchedule,
  PnlLine,
  PurchaseOrderLine,
  StockRow,
} from "./types";

const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

export const pnlForUnit = (data: Dataset, unit: BranchUnit): PnlLine[] =>
  data.pnl.filter((l) => unitKey(l) === unit.key);

/** Months (1–12) that have any revenue figure in the P&L of the given lines. */
export const activeMonths = (lines: PnlLine[]): number[] =>
  Array.from({ length: 12 }, (_, i) => i + 1).filter((m) =>
    lines.some((l) => l.months[m - 1] !== 0),
  );

export type KeyLine = { id: string; label: string; match: RegExp };

/** The headline lines of section IV (or the whole file when there is no section IV). */
export const KEY_LINES: KeyLine[] = [
  {
    id: "revenue",
    label: "Tổng doanh thu",
    match: /^(Tổng doanh thu|1\. DOANH THU)/i,
  },
  { id: "cogs", label: "Giá vốn", match: /^(Tổng giá vốn|2\. GIÁ VỐN)/i },
  {
    id: "gross",
    label: "Lợi nhuận trước chi phí",
    match: /^(Lợi nhuận trước chi phí|3\. LỢI NHUẬN TRƯỚC CHI PHÍ)/i,
  },
  { id: "expenses", label: "Chi phí", match: /^(Tổng chi phí|4\. CHI PHÍ)/i },
  {
    id: "net",
    label: "Lợi nhuận sau chi phí",
    match: /^(LỢI NHUẬN SAU CHI PHÍ|5\. LỢI NHUẬN SAU CHI PHÍ)/i,
  },
];

/** Value of a key line for one month: prefer the consolidated section (IV), else the first match. */
export const keyLineValue = (
  lines: PnlLine[],
  key: KeyLine,
  month: number,
): number => {
  const matches = lines.filter((l) => key.match.test(l.label));
  const consolidated =
    matches.find((l) => /^IV\./.test(l.section)) ?? matches.at(-1);
  return consolidated?.months[month - 1] ?? 0;
};

export type ScheduleSummary = {
  supplier: string;
  due: number;
  paid: number;
  remaining: number;
  rows: PaymentSchedule[];
};

export const scheduleBySupplier = (
  rows: PaymentSchedule[],
): ScheduleSummary[] => {
  const map = new Map<string, ScheduleSummary>();
  rows.forEach((r) => {
    const s = map.get(r.supplier) ?? {
      supplier: r.supplier,
      due: 0,
      paid: 0,
      remaining: 0,
      rows: [],
    };
    map.set(r.supplier, {
      ...s,
      due: s.due + r.due,
      paid: s.paid + r.paid,
      remaining: s.remaining + r.remaining,
      rows: [...s.rows, r],
    });
  });
  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
};

export type StockSummary = {
  branch: string;
  products: number;
  closing: number;
  outOfStock: number;
  expiring: number;
  value: number;
};

export const stockSummary = (
  rows: StockRow[],
  costOf: (product: string) => number,
): StockSummary[] => {
  const map = new Map<string, StockRow[]>();
  rows.forEach((r) => map.set(r.branch, [...(map.get(r.branch) ?? []), r]));
  return [...map.entries()].map(([branch, list]) => ({
    branch,
    products: list.length,
    closing: sum(list, (r) => r.closing),
    outOfStock: list.filter((r) => /hết/i.test(r.warning)).length,
    expiring: list.filter((r) => /hạn/i.test(r.warning)).length,
    value: sum(list, (r) => r.closing * costOf(r.product)),
  }));
};

export type OrdersSummary = {
  branch: string;
  openLines: number;
  pendingAmount: number;
  overdue: number;
};

export const purchaseOrdersSummary = (
  rows: PurchaseOrderLine[],
  today: string,
): OrdersSummary[] => {
  const map = new Map<string, PurchaseOrderLine[]>();
  rows.forEach((r) => map.set(r.branch, [...(map.get(r.branch) ?? []), r]));
  return [...map.entries()].map(([branch, list]) => {
    const open = list.filter((r) => !r.cancelled && r.missing > 0);
    return {
      branch,
      openLines: open.length,
      pendingAmount: sum(open, (r) => r.missing * r.unitPrice),
      overdue: open.filter((r) => r.expected && r.expected < today).length,
    };
  });
};
