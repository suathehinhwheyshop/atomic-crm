// Supplier ledger ("Công nợ NCC" tab): one line per event (opening balance,
// purchase, payment). Balances, ageing and overdue amounts are computed here.
import { parseAmount, parseDate, readTable } from "./sheet";
import type { BranchCode, GoodsLine, WorkbookSource } from "./types";

export type LedgerKind = "opening" | "purchase" | "payment";

export type SupplierEntry = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  supplier: string;
  kind: LedgerKind;
  ref: string;
  description: string;
  amount: number;
  dueDate: string;
  note: string;
};

const KINDS: Record<string, LedgerKind> = {
  "nợ đầu kỳ": "opening",
  "nhập hàng": "purchase",
  "trả tiền": "payment",
};

export const KIND_LABELS: Record<LedgerKind, string> = {
  opening: "Nợ đầu kỳ",
  purchase: "Nhập hàng",
  payment: "Trả tiền",
};

export const parseSupplierLedger = (
  source: WorkbookSource,
  values: string[][] | undefined,
): SupplierEntry[] => {
  const table = readTable(values);
  return table.rows.flatMap((row, index) => {
    const date = parseDate(table.get(row, "Ngày"));
    const supplier = table.get(row, "Nhà cung cấp");
    const kind = KINDS[table.get(row, "Loại").toLowerCase()];
    const amount = parseAmount(table.get(row, "Số tiền"));
    if (!date || !supplier || !kind || !amount) return [];
    return [
      {
        key: `${source.branch}-${source.line}-ncc-${index}`,
        branch: source.branch,
        line: source.line,
        date,
        supplier,
        kind,
        ref: table.get(row, "Số phiếu"),
        description: table.get(row, "Diễn giải"),
        amount,
        dueDate: parseDate(table.get(row, "Hạn thanh toán")),
        note: table.get(row, "Ghi chú"),
      },
    ];
  });
};

export type SupplierBalance = {
  supplier: string;
  branch: BranchCode;
  line: GoodsLine;
  opening: number;
  purchased: number;
  paid: number;
  balance: number;
  notDue: number;
  overdue30: number; // overdue up to 30 days
  overdue90: number; // overdue more than 30 days
  nextDue: string;
  entries: SupplierEntry[];
};

/**
 * Balance per supplier. Payments are allocated oldest-first (FIFO) to the opening
 * balance and purchases, so what remains unpaid keeps its own due date.
 */
export const supplierBalances = (
  entries: SupplierEntry[],
  today: string,
): SupplierBalance[] => {
  const groups = new Map<string, SupplierEntry[]>();
  entries.forEach((e) => {
    const id = `${e.branch}|${e.line}|${e.supplier}`;
    groups.set(id, [...(groups.get(id) ?? []), e]);
  });
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const debts = sorted
        .filter((e) => e.kind !== "payment")
        .map((e) => ({ ...e, left: e.amount }));
      let paid = 0;
      sorted
        .filter((e) => e.kind === "payment")
        .forEach((p) => {
          paid += p.amount;
          let remaining = p.amount;
          for (const d of debts) {
            if (remaining <= 0) break;
            const used = Math.min(d.left, remaining);
            d.left -= used;
            remaining -= used;
          }
        });
      const open = debts.filter((d) => d.left > 0);
      const bucket = (test: (d: (typeof open)[number]) => boolean) =>
        open.filter(test).reduce((t, d) => t + d.left, 0);
      const age = (d: (typeof open)[number]) =>
        d.dueDate
          ? Math.round((Date.parse(today) - Date.parse(d.dueDate)) / 86_400_000)
          : -1;
      const { branch, line, supplier } = sorted[0];
      return {
        supplier,
        branch,
        line,
        opening: sorted
          .filter((e) => e.kind === "opening")
          .reduce((t, e) => t + e.amount, 0),
        purchased: sorted
          .filter((e) => e.kind === "purchase")
          .reduce((t, e) => t + e.amount, 0),
        paid,
        balance: open.reduce((t, d) => t + d.left, 0),
        notDue: bucket((d) => age(d) <= 0),
        overdue30: bucket((d) => age(d) > 0 && age(d) <= 30),
        overdue90: bucket((d) => age(d) > 30),
        nextDue:
          open
            .map((d) => d.dueDate)
            .filter(Boolean)
            .sort()[0] ?? "",
        entries: sorted.reverse(),
      };
    })
    .sort((a, b) => b.balance - a.balance);
};
