// Parsers for the Sổ quỹ tab and the two proposed tabs (Tồn kho, Công nợ NCC).
import { parseAmount, parseDate, readTable } from "./sheet";
import type {
  CashbookRow,
  FundSummary,
  InventoryItem,
  WorkbookSource,
} from "./types";

/** Running balances of the Sổ quỹ tab: the last line of each day gives the closing balance. */
export const parseCashbook = (
  source: WorkbookSource,
  values: string[][] | undefined,
): CashbookRow[] => {
  const table = readTable(values);
  const byDate = new Map<string, CashbookRow>();
  // "Tồn MPOS chờ về" is only written on MPOS lines: carry the last value forward.
  let pendingCardBalance = 0;
  for (const row of table.rows) {
    const date = parseDate(table.get(row, "Ngày"));
    if (!date) continue;
    const pendingCell = table.get(row, "Tồn MPOS chờ về");
    if (pendingCell) pendingCardBalance = parseAmount(pendingCell);
    const previous = byDate.get(date);
    byDate.set(date, {
      cashIn:
        (previous?.cashIn ?? 0) + parseAmount(table.get(row, "Thu tiền mặt")),
      cashOut:
        (previous?.cashOut ?? 0) + parseAmount(table.get(row, "Chi tiền mặt")),
      bankIn:
        (previous?.bankIn ?? 0) +
        parseAmount(table.get(row, "Thu BIDV") || table.get(row, "Thu MB")),
      bankOut:
        (previous?.bankOut ?? 0) +
        parseAmount(table.get(row, "Chi BIDV") || table.get(row, "Chi MB")),
      branch: source.branch,
      line: source.line,
      date,
      cashBalance: parseAmount(table.get(row, "Tồn tiền mặt")),
      // "Tồn BIDV" in the HCT file, "Tồn MB" in the HXT file.
      bankBalance: parseAmount(
        table.get(row, "Tồn BIDV") || table.get(row, "Tồn MB"),
      ),
      pendingCardBalance,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

/** Summary block (rows "Tiền mặt" / "BIDV (gồm MPOS)" / "MB (gồm MPOS)") above the Sổ quỹ table. */
export const parseFundSummaries = (
  source: WorkbookSource,
  values: string[][] | undefined,
): FundSummary[] => {
  const all = values ?? [];
  const closingDate = parseDate(
    all.find((row) => String(row[0] ?? "").startsWith("Từ ngày"))?.[6] ?? "",
  );
  const read = (
    fund: "cash" | "bank",
    row: string[] | undefined,
  ): FundSummary[] =>
    row
      ? [
          {
            branch: source.branch,
            line: source.line,
            fund,
            opening: parseAmount(row[1]),
            closing: parseAmount(row[5]),
            actual: String(row[6] ?? "").trim() ? parseAmount(row[6]) : null,
            closingDate,
          },
        ]
      : [];
  const first = (prefix: string) =>
    all.find((row) =>
      String(row[0] ?? "")
        .trim()
        .startsWith(prefix),
    );
  return [
    ...read("cash", first("Tiền mặt")),
    ...read("bank", first("BIDV") ?? first("MB")),
  ];
};

/**
 * Proposed "Tồn kho" tab: header row "Ngày" (date of the count) then
 * Mã SP | Sản phẩm | Tồn | Tồn tối thiểu. Unit and cost price come from the catalog
 * (the optional Đơn vị / Giá vốn columns override them).
 */
export const parseInventory = (
  source: WorkbookSource,
  values: string[][] | undefined,
): InventoryItem[] => {
  const table = readTable(values);
  return table.rows.flatMap((row, index) => {
    const product = table.get(row, "Sản phẩm");
    const productCode = table.get(row, "Mã SP");
    if (!product && !productCode) return [];
    return [
      {
        key: `${source.branch}-${source.line}-inv-${index}`,
        branch: source.branch,
        line: source.line,
        productCode,
        product,
        quantity: parseAmount(table.get(row, "Tồn")),
        unit: table.get(row, "Đơn vị") || "cái",
        costPrice: parseAmount(table.get(row, "Giá vốn")),
        minimum: parseAmount(table.get(row, "Tồn tối thiểu")),
        updatedAt: parseDate(table.get(row, "Ngày")),
      },
    ];
  });
};
