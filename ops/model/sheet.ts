// Helpers to read the WheyShop report spreadsheets, whose tabs have a title
// block above a header row (first cell "Ngày") and Vietnamese number/date formats.

/** "4.020.000" / "2.190.000 đ" / "-680.000" -> number. Empty or invalid -> 0. */
export const parseAmount = (value: unknown): number => {
  const text = String(value ?? "")
    .replace(/[đ\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(text);
  return text && Number.isFinite(number) ? number : 0;
};

/** "21/10/2026" -> "2026-10-21". Already ISO -> unchanged. Invalid -> "". */
export const parseDate = (value: unknown): string => {
  const text = String(value ?? "").trim();
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (vn) {
    const [, day, month, year] = vn;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
};

export type Table = {
  rows: string[][];
  get: (row: string[], column: string) => string;
};

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Locate the header row (first cell "Ngày") and return the data rows below it with
 * a column accessor. Columns are matched exactly first, then by prefix, so small
 * header differences between files ("CK BIDV (tự tính)" / "CK MB (tự tính)") work.
 */
export const readTable = (values: string[][] | undefined): Table => {
  const all = values ?? [];
  const headerIndex = all.findIndex(
    (row) => normalize(row[0] ?? "") === "Ngày",
  );
  if (headerIndex < 0) return { rows: [], get: () => "" };

  const headers = all[headerIndex].map((h) => normalize(String(h ?? "")));
  const cache = new Map<string, number>();
  const indexOf = (column: string) => {
    if (!cache.has(column)) {
      const exact = headers.indexOf(column);
      cache.set(
        column,
        exact >= 0 ? exact : headers.findIndex((h) => h.startsWith(column)),
      );
    }
    return cache.get(column)!;
  };

  return {
    rows: all
      .slice(headerIndex + 1)
      .filter((row) => row.some((cell) => String(cell ?? "").trim() !== "")),
    get: (row, column) => {
      const index = indexOf(column);
      return index < 0 ? "" : String(row[index] ?? "").trim();
    },
  };
};
