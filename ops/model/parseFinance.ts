// Parsers for the BCTC (accounting) and Kho (stock) spreadsheets.
import { parseCatalog, type Product } from "./catalog";
import { findTab } from "./parseWorkbook";
import { parseAmount, parseDate, readTable } from "./sheet";
import type { SupplierEntry } from "./supplierLedger";
import type {
  DailyBook,
  PaymentSchedule,
  PnlLine,
  PurchaseOrderLine,
  ReceiptLine,
  StockRow,
  SupplierInfo,
  WorkbookSource,
} from "./types";

export const BCTC_TABS = {
  pnl: ["BCTC tháng", "Báo cáo tài chính tháng", "Báo cáo tài chính"],
  daily: ["DT ngày", "Doanh thu ngày"],
  ledger: ["Công nợ NCC", "Công nợ Nhà cung cấp"],
  summary: ["Tóm tắt công nợ"],
  schedule: ["Lịch TT NCC", "Lịch Thanh toán Nhà cung cấp"],
} as const;

export const KHO_TABS = {
  stock: ["Hàng xách tay tồn kho"],
  orders: ["Hàng công ty đã đặt"],
  receipts: ["Hàng công ty mới về"],
  catalog: ["Danh mục"],
} as const;

const MONTHS = 12;

/** Monthly P&L: header row "Khoản mục", section rows start with a roman numeral. */
export const parsePnl = (
  source: WorkbookSource,
  values: string[][] | undefined,
): PnlLine[] => {
  const all = values ?? [];
  const headerIndex = all.findIndex(
    (row) => String(row[0] ?? "").trim() === "Khoản mục",
  );
  if (headerIndex < 0) return [];
  let section = "";
  const lines: PnlLine[] = [];
  for (const row of all.slice(headerIndex + 1)) {
    const label = String(row[0] ?? "").trim();
    if (!label) continue;
    if (/^(I|II|III|IV|V|VI)\.\s/.test(label)) {
      section = label;
      continue;
    }
    if (
      /^(SỐ LIỆU TÍCH LŨY|Trạng thái số liệu|Cập nhật đến|DT lũy kế|Doanh thu lũy kế|Số ngày)/i.test(
        label,
      )
    )
      continue;
    const months = Array.from({ length: MONTHS }, (_, i) =>
      parseAmount(row[i + 1]),
    );
    if (label.startsWith("%")) continue;
    lines.push({
      branch: source.branch,
      line: source.line,
      section,
      label,
      months,
      total:
        row[MONTHS + 1] !== undefined && String(row[MONTHS + 1]).trim()
          ? parseAmount(row[MONTHS + 1])
          : months.reduce((t, v) => t + v, 0),
      emphasis: /^\d\.\s|^(Tổng|LỢI NHUẬN|Doanh thu$|Lợi nhuận)/.test(label),
    });
  }
  return lines;
};

/** "DT ngày": Sapo revenue per channel and cost of goods per channel per day. */
export const parseDailyBooks = (
  source: WorkbookSource,
  values: string[][] | undefined,
): DailyBook[] => {
  const table = readTable(values);
  return table.rows.flatMap((row) => {
    const date = parseDate(table.get(row, "Ngày"));
    if (!date) return [];
    return [
      {
        branch: source.branch,
        line: source.line,
        date,
        revenueStore: parseAmount(
          table.get(
            row,
            "DT Cửa hàng",
            "Doanh thu Cửa hàng dùng cho báo cáo",
            "Doanh thu Cửa hàng",
          ),
        ),
        revenueLocal: parseAmount(
          table.get(
            row,
            "DT Nội thành",
            "Doanh thu Nội thành dùng cho báo cáo",
            "Doanh thu Nội thành",
          ),
        ),
        revenuePost: parseAmount(
          table.get(
            row,
            "DT Bưu điện",
            "Doanh thu Bưu điện dùng cho báo cáo",
            "Doanh thu Bưu điện",
          ),
        ),
        costStore: parseAmount(
          table.get(row, "GV Cửa hàng", "Giá vốn Cửa hàng"),
        ),
        costLocal: parseAmount(
          table.get(row, "GV Nội thành", "Giá vốn Nội thành"),
        ),
        costPost: parseAmount(
          table.get(row, "GV Bưu điện", "Giá vốn Bưu điện"),
        ),
        check: table.get(row, "Kiểm tra"),
      },
    ];
  });
};

/**
 * BCTC supplier ledger: Ngày | NCC | Chi nhánh | Diễn giải | Nhập hàng | Đã trả | Quỹ trả.
 * A "Số dư đầu kỳ" line is an opening balance written in the Nhập hàng column.
 */
export const parseBctcLedger = (
  source: WorkbookSource,
  values: string[][] | undefined,
): SupplierEntry[] => {
  const table = readTable(values);
  return table.rows.flatMap((row, index) => {
    const supplier = table.get(row, "NCC", "Nhà cung cấp");
    const purchased = parseAmount(table.get(row, "Nhập hàng"));
    const paid = parseAmount(table.get(row, "Đã trả"));
    if (!supplier || (!purchased && !paid)) return [];
    const description = table.get(row, "Diễn giải");
    const base = {
      branch: source.branch,
      line: source.line,
      date: parseDate(table.get(row, "Ngày")) || "0000-00-00",
      supplier,
      ref: table.get(row, "Chi nhánh"),
      description,
      dueDate: "",
      note: table.get(row, "Ghi chú"),
    };
    const entries: SupplierEntry[] = [];
    if (purchased) {
      entries.push({
        ...base,
        key: `${source.branch}-${source.line}-bctc-${index}-in`,
        kind: /số dư đầu/i.test(description) ? "opening" : "purchase",
        amount: purchased,
      });
    }
    if (paid) {
      entries.push({
        ...base,
        key: `${source.branch}-${source.line}-bctc-${index}-out`,
        kind: "payment",
        amount: paid,
      });
    }
    return entries;
  });
};

/** "Tóm tắt công nợ": company and bank per supplier (the amounts are recomputed from the ledger). */
export const parseSupplierInfo = (
  source: WorkbookSource,
  values: string[][] | undefined,
): SupplierInfo[] => {
  const table = readTable(values, "Nhà cung cấp");
  return table.rows.flatMap((row) => {
    const supplier = table.get(row, "Nhà cung cấp");
    if (!supplier || supplier === "TỔNG") return [];
    return [
      {
        branch: source.branch,
        line: source.line,
        supplier,
        company: table.get(row, "Công ty"),
        bank: table.get(row, "Ngân hàng"),
      },
    ];
  });
};

export const parsePaymentSchedule = (
  source: WorkbookSource,
  values: string[][] | undefined,
): PaymentSchedule[] => {
  const table = readTable(values);
  return table.rows.flatMap((row, index) => {
    const date = parseDate(table.get(row, "Ngày"));
    const supplier = table.get(row, "NCC", "Nhà cung cấp");
    const due = parseAmount(table.get(row, "Công nợ"));
    if (!date || !supplier) return [];
    const paid = parseAmount(table.get(row, "Đã thanh toán"));
    return [
      {
        key: `${source.branch}-${source.line}-sched-${index}`,
        branch: source.branch,
        line: source.line,
        date,
        supplier,
        note: table.get(row, "Chi nhánh"),
        due,
        paid,
        remaining: table.get(row, "Còn thiếu")
          ? parseAmount(table.get(row, "Còn thiếu"))
          : due - paid,
        method: table.get(row, "Phương thức"),
      },
    ];
  });
};

export const parseStock = (
  source: WorkbookSource,
  values: string[][] | undefined,
): StockRow[] => {
  const table = readTable(values, "Sản phẩm");
  return table.rows.flatMap((row, index) => {
    const product = table.get(row, "Sản phẩm");
    if (!product) return [];
    return [
      {
        key: `${source.branch}-stock-${index}`,
        branch: source.branch,
        product,
        opening: parseAmount(table.get(row, "Tồn đầu kỳ")),
        received: parseAmount(table.get(row, "Nhập trong kỳ")),
        sold: parseAmount(table.get(row, "Bán trong kỳ")),
        transferred: parseAmount(table.get(row, "Chuyển chi nhánh")),
        closing: parseAmount(table.get(row, "Tồn cuối")),
        expiry: parseDate(
          table.get(row, "HSD gần nhất", "Hạn sử dụng gần nhất"),
        ),
        minimum: parseAmount(table.get(row, "Tồn tối thiểu")),
        warning: table.get(row, "Cảnh báo"),
      },
    ];
  });
};

export const parsePurchaseOrders = (
  source: WorkbookSource,
  values: string[][] | undefined,
): PurchaseOrderLine[] => {
  const table = readTable(values, "Ngày đặt");
  return table.rows.flatMap((row, index) => {
    const po = table.get(row, "Mã PO");
    const product = table.get(row, "Sản phẩm");
    if (!po || !product) return [];
    return [
      {
        key: `${source.branch}-po-${index}`,
        branch: source.branch,
        date: parseDate(table.get(row, "Ngày đặt")),
        po,
        supplier: table.get(row, "NCC"),
        product,
        ordered: parseAmount(table.get(row, "SL đặt")),
        unitPrice: parseAmount(table.get(row, "Đơn giá nhập")),
        expected: parseDate(table.get(row, "Ngày dự kiến về")),
        received: parseAmount(table.get(row, "SL đã nhận")),
        missing: parseAmount(table.get(row, "SL còn thiếu")),
        status: table.get(row, "Trạng thái"),
        cancelled: /^(true|x|có)$/i.test(table.get(row, "Hủy đơn")),
      },
    ];
  });
};

export const parseReceipts = (
  source: WorkbookSource,
  values: string[][] | undefined,
): ReceiptLine[] => {
  const table = readTable(values, "Ngày nhận");
  return table.rows.flatMap((row, index) => {
    const product = table.get(row, "Sản phẩm");
    const date = parseDate(table.get(row, "Ngày nhận"));
    if (!product || !date) return [];
    return [
      {
        key: `${source.branch}-rc-${index}`,
        branch: source.branch,
        date,
        po: table.get(row, "Mã PO"),
        supplier: table.get(row, "NCC"),
        product,
        quantity: parseAmount(table.get(row, "SL nhận")),
        unitPrice: parseAmount(table.get(row, "Đơn giá nhập")),
        amount: parseAmount(table.get(row, "Thành tiền")),
        expiry: parseDate(table.get(row, "Hạn sử dụng")),
      },
    ];
  });
};

/** Kho "Danh mục": Mã SP | Tên sản phẩm | Loại hàng | NCC | Đơn vị | Giá nhập | Tồn tối thiểu. */
export const parseKhoCatalog = (values: string[][] | undefined): Product[] => {
  const table = readTable(values, "Mã SP (Sapo/Kiot)");
  const direct = table.rows.flatMap((row, index) => {
    const name = table.get(row, "Tên sản phẩm");
    if (!name) return [];
    return [
      {
        code: table.get(row, "Mã SP") || `KHO-${index + 1}`,
        name,
        brand: table.get(row, "NCC"),
        group: table.get(row, "Loại hàng"),
        spec: "",
        unit: table.get(row, "Đơn vị") || "hộp",
        costPrice: parseAmount(table.get(row, "Giá nhập")),
        aliases: [],
      },
    ];
  });
  // Also accept the proposed catalog layout (Mã SP | Tên chuẩn | … | Tên khác).
  return direct.length ? direct : parseCatalog(values);
};

export type FinanceParts = {
  pnl: PnlLine[];
  dailyBooks: DailyBook[];
  supplierLedger: SupplierEntry[];
  supplierInfo: SupplierInfo[];
  paymentSchedule: PaymentSchedule[];
};

export const parseBctcWorkbook = (source: WorkbookSource): FinanceParts => ({
  pnl: parsePnl(source, findTab(source, BCTC_TABS.pnl)),
  dailyBooks: parseDailyBooks(source, findTab(source, BCTC_TABS.daily)),
  supplierLedger: parseBctcLedger(source, findTab(source, BCTC_TABS.ledger)),
  supplierInfo: parseSupplierInfo(source, findTab(source, BCTC_TABS.summary)),
  paymentSchedule: parsePaymentSchedule(
    source,
    findTab(source, BCTC_TABS.schedule),
  ),
});

export type KhoParts = {
  stock: StockRow[];
  purchaseOrders: PurchaseOrderLine[];
  receipts: ReceiptLine[];
  catalog: Product[];
};

export const parseKhoWorkbook = (source: WorkbookSource): KhoParts => ({
  stock: parseStock(source, findTab(source, KHO_TABS.stock)),
  purchaseOrders: parsePurchaseOrders(source, findTab(source, KHO_TABS.orders)),
  receipts: parseReceipts(source, findTab(source, KHO_TABS.receipts)),
  catalog: parseKhoCatalog(findTab(source, KHO_TABS.catalog)),
});
