// Branch-level reports for the Hàng hóa / Tài chính sections.
import { periodOf, periodsOf, type Granularity, type Period } from "./period";
import { supplierBalances, type SupplierBalance } from "./supplierLedger";
import type {
  BranchCode,
  CashbookRow,
  Dataset,
  GoodsLine,
  InventoryItem,
  Order,
} from "./types";

export type BranchKey = `${BranchCode}-${GoodsLine}`;

export type BranchUnit = {
  key: BranchKey;
  branch: BranchCode;
  line: GoodsLine;
};

const isOk = (check: string) => check.startsWith("OK");
const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

export const unitKey = (r: {
  branch: BranchCode;
  line: GoodsLine;
}): BranchKey => `${r.branch}-${r.line}`;

const BRANCH_ORDER: BranchCode[] = ["HN", "HCM", "VINH", "DN"];
const LINE_ORDER: GoodsLine[] = ["HCT", "HXT", "GOP"];

/** Branch units (HN-HCT, HN-HXT, HCM-HCT, …) present in the data, in display order. */
export const branchUnits = (data: Dataset): BranchUnit[] => {
  const seen = new Map<BranchKey, BranchUnit>();
  const add = (r: { branch: BranchCode; line: GoodsLine }) =>
    seen.set(unitKey(r), { key: unitKey(r), branch: r.branch, line: r.line });
  data.orders.forEach(add);
  data.cashEntries.forEach(add);
  data.inventory.forEach(add);
  data.supplierLedger.forEach(add);
  data.cashbook.forEach(add);
  return [...seen.values()].sort(
    (a, b) =>
      BRANCH_ORDER.indexOf(a.branch) - BRANCH_ORDER.indexOf(b.branch) ||
      LINE_ORDER.indexOf(a.line) - LINE_ORDER.indexOf(b.line),
  );
};

/** A metric per period (rows) and branch unit (columns). */
export type Matrix = {
  periods: Period[];
  units: BranchUnit[];
  values: Map<string, number>; // `${period.key}|${unit.key}`
};

export const cellKey = (period: string, unit: string) => `${period}|${unit}`;

const buildMatrix = <
  T extends { date: string; branch: BranchCode; line: GoodsLine },
>(
  items: T[],
  units: BranchUnit[],
  granularity: Granularity,
  value: (item: T) => number,
): Matrix => {
  const values = new Map<string, number>();
  items.forEach((item) => {
    const key = cellKey(periodOf(item.date, granularity).key, unitKey(item));
    values.set(key, (values.get(key) ?? 0) + value(item));
  });
  return {
    periods: periodsOf(
      items.map((i) => i.date),
      granularity,
    ),
    units,
    values,
  };
};

export const matrixTotal = (
  m: Matrix,
  period?: string,
  unit?: string,
): number => {
  let total = 0;
  m.values.forEach((v, key) => {
    const [p, u] = key.split("|");
    if ((!period || p === period) && (!unit || u === unit)) total += v;
  });
  return total;
};

// ---- Hàng hóa ----

export type ProductVolumeRow = {
  product: string;
  code: string; // empty when the typed name is not in the catalog
  total: number;
  perUnit: Map<BranchKey, number>;
};

/** Units sold per product per branch in the period, from counted orders (all channels with items). */
export const productVolume = (orders: Order[]): ProductVolumeRow[] => {
  const rows = new Map<string, ProductVolumeRow>();
  orders
    .filter((o) => o.revenue > 0)
    .forEach((o) =>
      o.items
        .filter((i) => i.product && i.unitPrice > 0)
        .forEach((i) => {
          const id = i.productCode
            ? `code:${i.productCode}`
            : `name:${i.product}`;
          const row = rows.get(id) ?? {
            product: i.canonicalName ?? i.product,
            code: i.productCode ?? "",
            total: 0,
            perUnit: new Map(),
          };
          const key = unitKey(o);
          row.perUnit.set(key, (row.perUnit.get(key) ?? 0) + i.quantity);
          rows.set(id, { ...row, total: row.total + i.quantity });
        }),
    );
  return [...rows.values()].sort((a, b) => b.total - a.total);
};

/** Units sold per period per branch unit. */
export const volumeMatrix = (
  orders: Order[],
  units: BranchUnit[],
  granularity: Granularity,
): Matrix =>
  buildMatrix(
    orders.filter((o) => o.revenue > 0),
    units,
    granularity,
    (o) =>
      sum(
        o.items.filter((i) => i.unitPrice > 0),
        (i) => i.quantity,
      ),
  );

export type InventorySummary = {
  unit: BranchUnit;
  products: number;
  quantity: number;
  value: number;
  belowMinimum: number;
  updatedAt: string;
};

export const inventorySummary = (
  items: InventoryItem[],
  units: BranchUnit[],
): InventorySummary[] =>
  units
    .map((unit) => {
      const list = items.filter((i) => unitKey(i) === unit.key);
      return {
        unit,
        products: list.length,
        quantity: sum(list, (i) => i.quantity),
        value: sum(list, (i) => i.quantity * i.costPrice),
        belowMinimum: list.filter(
          (i) => i.minimum > 0 && i.quantity <= i.minimum,
        ).length,
        updatedAt:
          list
            .map((i) => i.updatedAt)
            .sort()
            .at(-1) ?? "",
      };
    })
    .filter((s) => s.products > 0);

// ---- Tài chính ----

export type DebtSummary = {
  unit: BranchUnit;
  suppliers: number;
  opening: number;
  purchased: number;
  paid: number;
  balance: number;
  overdue: number;
  balances: SupplierBalance[];
};

export const debtSummary = (
  data: Dataset,
  units: BranchUnit[],
  today: string,
): DebtSummary[] => {
  const all = supplierBalances(data.supplierLedger, today);
  return units
    .map((unit) => {
      const balances = all.filter((b) => unitKey(b) === unit.key);
      return {
        unit,
        suppliers: balances.length,
        opening: sum(balances, (b) => b.opening),
        purchased: sum(balances, (b) => b.purchased),
        paid: sum(balances, (b) => b.paid),
        balance: sum(balances, (b) => b.balance),
        overdue: sum(balances, (b) => b.overdue30 + b.overdue90),
        balances,
      };
    })
    .filter((s) => s.suppliers > 0);
};

export type FundPoint = {
  date: string;
  cash: number;
  bank: number;
  pendingCard: number;
  total: number;
};

/** Closing balances per date for the selected units (sum across units). */
export const fundSeries = (rows: CashbookRow[]): FundPoint[] => {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const latest = new Map<BranchKey, CashbookRow>();
  const byDate = new Map<string, CashbookRow[]>();
  rows.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));
  return dates.map((date) => {
    (byDate.get(date) ?? []).forEach((r) => latest.set(unitKey(r), r));
    const current = [...latest.values()];
    const cash = sum(current, (r) => r.cashBalance);
    const bank = sum(current, (r) => r.bankBalance);
    const pendingCard = sum(current, (r) => r.pendingCardBalance);
    return { date, cash, bank, pendingCard, total: cash + bank };
  });
};

export const fundLatestByUnit = (rows: CashbookRow[], units: BranchUnit[]) =>
  units.flatMap((unit) => {
    const last = rows
      .filter((r) => unitKey(r) === unit.key)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    return last ? [{ unit, ...last }] : [];
  });

/** Internal transfers and supplier payments are not operating expenses. */
const NON_OPERATING_GROUPS = new Set(["NỘP - CHUYỂN QUỸ (CHI)", "CÔNG NỢ NCC"]);

export const isOperatingExpense = (e: {
  kind: string;
  group: string;
  check: string;
}) => e.kind === "Chi" && isOk(e.check) && !NON_OPERATING_GROUPS.has(e.group);

export const isSupplierPayment = (e: {
  kind: string;
  group: string;
  check: string;
}) => e.kind === "Chi" && isOk(e.check) && e.group === "CÔNG NỢ NCC";

const countedRevenue = (data: Dataset) => [
  ...data.orders
    .filter((o) => o.revenue > 0)
    .map((o) => ({ ...o, amount: o.revenue })),
  ...data.platformOrders
    .filter((o) => isOk(o.check))
    .map((o) => ({ ...o, amount: o.revenue })),
];

/** Cost of goods sold from catalog cost prices; coverage = share of sold units that have a cost. */
export const costOfGoods = (
  orders: Order[],
): { cost: number; coverage: number } => {
  const items = orders
    .filter((o) => o.revenue > 0)
    .flatMap((o) => o.items)
    .filter((i) => i.unitPrice > 0);
  const units = sum(items, (i) => i.quantity);
  const covered = sum(
    items.filter((i) => i.costPrice),
    (i) => i.quantity,
  );
  return {
    cost: sum(items, (i) => i.quantity * (i.costPrice ?? 0)),
    coverage: units ? covered / units : 0,
  };
};

export const costMatrix = (
  orders: Order[],
  units: BranchUnit[],
  granularity: Granularity,
): Matrix =>
  buildMatrix(
    orders.filter((o) => o.revenue > 0),
    units,
    granularity,
    (o) => sum(o.items, (i) => i.quantity * (i.costPrice ?? 0)),
  );

export const revenueMatrix = (
  data: Dataset,
  units: BranchUnit[],
  granularity: Granularity,
): Matrix =>
  buildMatrix(countedRevenue(data), units, granularity, (r) => r.amount);

export const orderCountMatrix = (
  data: Dataset,
  units: BranchUnit[],
  granularity: Granularity,
): Matrix => buildMatrix(countedRevenue(data), units, granularity, () => 1);

export const expenseMatrix = (
  data: Dataset,
  units: BranchUnit[],
  granularity: Granularity,
): Matrix =>
  buildMatrix(
    data.cashEntries.filter(isOperatingExpense),
    units,
    granularity,
    (e) => e.amount,
  );

export const supplierPaymentMatrix = (
  data: Dataset,
  units: BranchUnit[],
  granularity: Granularity,
): Matrix =>
  buildMatrix(
    data.cashEntries.filter(isSupplierPayment),
    units,
    granularity,
    (e) => e.amount,
  );

export type ExpenseGroupRow = {
  group: string;
  total: number;
  perUnit: Map<BranchKey, number>;
};

/** Operating expenses by group (rows) and branch unit (columns) in the period. */
export const expensesByGroup = (data: Dataset): ExpenseGroupRow[] => {
  const rows = new Map<string, ExpenseGroupRow>();
  data.cashEntries.filter(isOperatingExpense).forEach((e) => {
    const row = rows.get(e.group) ?? {
      group: e.group,
      total: 0,
      perUnit: new Map(),
    };
    row.perUnit.set(unitKey(e), (row.perUnit.get(unitKey(e)) ?? 0) + e.amount);
    rows.set(e.group, { ...row, total: row.total + e.amount });
  });
  return [...rows.values()].sort((a, b) => b.total - a.total);
};

export type StatementRow = {
  unit: BranchUnit;
  revenue: number;
  orders: number;
  expenses: number;
  costOfGoods: number;
  costCoverage: number;
  grossProfit: number; // revenue − cost of goods (catalog prices)
  supplierPayments: number;
  operatingResult: number; // gross profit − operating expenses
  debtBalance: number;
  cash: number;
  bank: number;
  pendingCard: number;
};

/** Monthly statement per branch unit for the selected period. */
export const financialStatement = (
  data: Dataset,
  units: BranchUnit[],
): StatementRow[] =>
  units.map((unit) => {
    const of = <T extends { branch: BranchCode; line: GoodsLine }>(list: T[]) =>
      list.filter((r) => unitKey(r) === unit.key);
    const revenueRows = of(countedRevenue(data));
    const revenue = sum(revenueRows, (r) => r.amount);
    const expenses = sum(
      of(data.cashEntries).filter(isOperatingExpense),
      (e) => e.amount,
    );
    const latest = of(data.cashbook)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    const cogs = costOfGoods(of(data.orders));
    return {
      unit,
      revenue,
      orders: revenueRows.length,
      expenses,
      costOfGoods: cogs.cost,
      costCoverage: cogs.coverage,
      grossProfit: revenue - cogs.cost,
      supplierPayments: sum(
        of(data.cashEntries).filter(isSupplierPayment),
        (e) => e.amount,
      ),
      operatingResult: revenue - cogs.cost - expenses,
      debtBalance: sum(
        supplierBalances(of(data.supplierLedger), "9999-12-31"),
        (b) => b.balance,
      ),
      cash: latest?.cashBalance ?? 0,
      bank: latest?.bankBalance ?? 0,
      pendingCard: latest?.pendingCardBalance ?? 0,
    };
  });
