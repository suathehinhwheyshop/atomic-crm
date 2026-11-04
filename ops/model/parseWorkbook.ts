import { findCatalogTab, mergeCatalogs, parseCatalog } from "./catalog";
import {
  parseCashbook,
  parseFundSummaries,
  parseInventory,
} from "./parseExtras";
import { parseBctcWorkbook, parseKhoWorkbook } from "./parseFinance";
import {
  ledgerFromCashEntries,
  parseSupplierLedger,
  type SupplierEntry,
} from "./supplierLedger";
import { parseAmount, parseDate, readTable, type Table } from "./sheet";
import type {
  CashEntry,
  Channel,
  Dataset,
  Order,
  PendingCard,
  PlatformOrder,
  WorkbookSource,
} from "./types";

/** Tab title prefixes per branch file (HN / Q10 / Da Nang / Vinh spell them differently). */
export const SALES_TABS = {
  store: ["Đơn CH", "Đơn Cửa hàng", "Đơn Tại Cửa hàng"],
  local: ["Đơn NT", "Đơn Nội thành", "Đơn Ship Nội thành"],
  post: ["Đơn Bưu điện", "Đơn COD"],
  tiktok: ["Đơn Tiktok"],
  shopee: ["Đơn Shopee"],
  expenses: ["Bảng Chi phí", "Chi Phí", "Chi phí"],
  pendingCards: ["MPOS về"],
  cashbook: ["Sổ quỹ"],
  inventory: ["Tồn kho"],
  supplierDebts: ["Công nợ NCC", "Công nợ Nhà cung cấp"],
} as const;

const lower = (text: string) => text.toLowerCase();

export const findTab = (
  source: WorkbookSource,
  prefixes: readonly string[],
) => {
  for (const prefix of prefixes) {
    const hit = Object.entries(source.tabs).find(([title]) =>
      lower(title).startsWith(lower(prefix)),
    );
    if (hit) return hit[1];
  }
  return undefined;
};

// Column aliases across the branch files.
const COL = {
  phone: ["SĐT", "Số điện thoại"],
  quantity: ["SL", "Số lượng"],
  paymentMethod: ["Hình thức TT", "Hình thức thanh toán"],
  paymentStatus: ["Trạng thái TT", "Trạng thái thanh toán"],
  cash: ["Tiền mặt (tự tính)"],
  bank: ["CK ", "Chuyển khoản"],
  card: ["MPOS (tự tính)"],
  total: ["Tổng tiền khách trả"],
  lineTotal: ["Tiền SP", "Tiền sản phẩm"],
} as const;

const isOk = (check: string) => check.startsWith("OK");

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

/**
 * Store and local-delivery tabs: one row per product, the order fields are only on
 * the first row. A row without order code and date continues the previous order.
 */
const parseItemOrders = (
  source: WorkbookSource,
  channel: "store" | "local",
  table: Table,
): Order[] => {
  const { get } = table;
  const orders: Order[] = [];
  for (const row of table.rows) {
    const code = get(row, "Mã đơn");
    const date = parseDate(get(row, "Ngày"));
    const item = {
      product: get(row, "Sản phẩm"),
      quantity: parseAmount(get(row, ...COL.quantity)),
      unitPrice: parseAmount(get(row, "Đơn giá")),
      discount: parseAmount(get(row, "Chiết khấu")),
    };
    const previous = orders.at(-1);
    if (!code && !date && previous) {
      if (item.product) previous.items.push(item);
      continue;
    }
    if (!code || !date) continue;

    const check = get(row, "Kiểm tra");
    const total = parseAmount(get(row, ...COL.total));
    const deliveryStatus = get(row, "Trạng thái giao");
    const counted =
      isOk(check) && (channel === "store" || deliveryStatus === "Đã giao");
    orders.push({
      key: `${source.branch}-${source.line}-${channel}-${code}-${orders.length}`,
      branch: source.branch,
      line: source.line,
      channel,
      date,
      shift: get(row, "Ca"),
      staff: get(row, "Nhân viên").toUpperCase(),
      code,
      source: channel === "store" ? "Cửa hàng" : get(row, "Nguồn"),
      customer: get(row, "Khách hàng"),
      phone: normalizePhone(get(row, ...COL.phone)),
      address: get(row, "Địa chỉ"),
      items: item.product ? [item] : [],
      total,
      shippingFee: parseAmount(get(row, "Phí ship thu khách")),
      paymentMethod: get(row, ...COL.paymentMethod),
      paymentStatus: get(row, ...COL.paymentStatus),
      deliveryStatus: channel === "store" ? "Đã giao" : deliveryStatus,
      postType: "",
      cash: parseAmount(get(row, ...COL.cash)),
      bank: parseAmount(get(row, ...COL.bank)),
      card: parseAmount(get(row, ...COL.card)),
      cod: 0,
      check,
      inCashbook: get(row, "Vào Sổ quỹ") === "Đã vào sổ quỹ",
      revenue: counted ? total : 0,
    });
  }
  return orders;
};

/** Post office orders: one row per order. Revenue: delivered + new = total, resend = shipping only, returned = 0. */
const parsePostOrders = (source: WorkbookSource, table: Table): Order[] => {
  const { get } = table;
  return table.rows.flatMap((row, index) => {
    const code = get(row, "Mã đơn");
    const date = parseDate(get(row, "Ngày"));
    if (!code || !date) return [];
    const total = parseAmount(get(row, "Tổng thu"));
    const shippingFee = parseAmount(get(row, "Phí ship"));
    const postType = get(row, "Loại đơn");
    const deliveryStatus = get(row, "Trạng thái giao");
    const method = get(row, "Hình thức thu");
    const isCod = method.startsWith("COD");
    const received = parseAmount(get(row, "Tiền thực nhận")) || total;
    const revenue =
      deliveryStatus !== "Đã giao"
        ? 0
        : postType === "Mới"
          ? total
          : postType === "Gửi lại"
            ? shippingFee
            : 0;
    const check = get(row, "Kiểm tra");
    const paid = get(row, ...COL.paymentStatus) === "Đã thanh toán";
    const order: Order = {
      key: `${source.branch}-${source.line}-post-${code}-${index}`,
      branch: source.branch,
      line: source.line,
      channel: "post",
      date,
      shift: get(row, "Ca"),
      staff: get(row, "Nhân viên").toUpperCase(),
      code,
      source: get(row, "Nguồn"),
      customer: get(row, "Khách hàng"),
      phone: normalizePhone(get(row, ...COL.phone)),
      address: get(row, "Địa chỉ"),
      items: [
        {
          product: get(row, "Sản phẩm"),
          quantity: parseAmount(get(row, "Tổng SL")) || 1,
          unitPrice: parseAmount(get(row, "Tiền hàng")),
          discount: parseAmount(get(row, "Chiết khấu")),
        },
      ],
      total,
      shippingFee,
      paymentMethod: method,
      paymentStatus: get(row, ...COL.paymentStatus),
      deliveryStatus,
      postType,
      cash: 0,
      bank: !isCod && paid ? received : 0,
      card: 0,
      cod: isCod ? total : 0,
      // An empty check cell means the sheet found nothing wrong.
      check: check || "OK",
      inCashbook: !isCod && paid && (!check || isOk(check)),
      revenue,
    };
    return [order];
  });
};

const parsePlatformOrders = (
  source: WorkbookSource,
  channel: "tiktok" | "shopee",
  table: Table,
): PlatformOrder[] =>
  table.rows.flatMap((row, index) => {
    const date = parseDate(table.get(row, "Ngày"));
    const code = table.get(row, "ID đơn hàng");
    if (!date || !code) return [];
    return [
      {
        key: `${source.branch}-${source.line}-${channel}-${code}-${index}`,
        branch: source.branch,
        line: source.line,
        channel,
        date,
        code,
        revenue: parseAmount(table.get(row, "Doanh thu")),
        netRevenue: parseAmount(table.get(row, "Doanh thu thực nhận")),
        fee: parseAmount(table.get(row, "Chi phí")),
        check: table.get(row, "Hệ thống"),
      },
    ];
  });

const parseCashEntries = (source: WorkbookSource, table: Table): CashEntry[] =>
  table.rows.flatMap((row, index) => {
    const date = parseDate(table.get(row, "Ngày"));
    const amount = parseAmount(table.get(row, "Số tiền"));
    if (!date || !amount) return [];
    return [
      {
        key: `${source.branch}-${source.line}-cash-${index}`,
        branch: source.branch,
        line: source.line,
        date,
        kind: table.get(row, "Loại"),
        group: table.get(row, "Nhóm"),
        description: table.get(row, "Diễn giải"),
        amount,
        fund: table.get(row, "Quỹ"),
        targetFund: table.get(row, "Quỹ nhận"),
        check: table.get(row, "Kiểm tra"),
        spender: table.get(row, "Người chi"),
        voucher: table.get(row, "Mã CT"),
      },
    ];
  });

/** "MPOS về ..." tab: the auto-filled pending list starts at the "Ngày bán" column of its header row. */
const parsePendingCards = (
  source: WorkbookSource,
  values: string[][] | undefined,
): PendingCard[] => {
  const all = values ?? [];
  const headerIndex = all.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim() === "Ngày bán"),
  );
  if (headerIndex < 0) return [];
  const start = all[headerIndex].findIndex(
    (cell) => String(cell ?? "").trim() === "Ngày bán",
  );
  return all.slice(headerIndex + 1).flatMap((row, index) => {
    const [dateCell, sourceCell, code, amount, days] = row.slice(
      start,
      start + 5,
    );
    const date = parseDate(dateCell);
    if (!date || !code) return [];
    return [
      {
        key: `${source.branch}-${source.line}-mpos-${code}-${index}`,
        branch: source.branch,
        line: source.line,
        date,
        source: String(sourceCell ?? ""),
        code: String(code),
        amount: parseAmount(amount),
        waitingDays: parseAmount(days),
      },
    ];
  });
};

const EMPTY: Dataset = {
  orders: [],
  platformOrders: [],
  cashEntries: [],
  pendingCards: [],
  cashbook: [],
  fundSummaries: [],
  inventory: [],
  supplierLedger: [],
  catalog: [],
  pnl: [],
  dailyBooks: [],
  supplierInfo: [],
  paymentSchedule: [],
  stock: [],
  purchaseOrders: [],
  receipts: [],
};

export const parseWorkbook = (source: WorkbookSource): Dataset => {
  if (source.kind === "bctc") return { ...EMPTY, ...parseBctcWorkbook(source) };
  if (source.kind === "kho") return { ...EMPTY, ...parseKhoWorkbook(source) };
  if (source.kind === "price") return EMPTY;
  return parseSalesWorkbook(source);
};

const parseSalesWorkbook = (source: WorkbookSource): Dataset => {
  const table = (prefixes: readonly string[]) =>
    readTable(findTab(source, prefixes));
  const channels: Array<["store" | "local", readonly string[]]> = [
    ["store", SALES_TABS.store],
    ["local", SALES_TABS.local],
  ];
  const cashEntries = parseCashEntries(source, table(SALES_TABS.expenses));
  return {
    orders: [
      ...channels.flatMap(([channel, prefix]) =>
        parseItemOrders(source, channel, table(prefix)),
      ),
      ...parsePostOrders(source, table(SALES_TABS.post)),
    ],
    platformOrders: [
      ...parsePlatformOrders(source, "tiktok", table(SALES_TABS.tiktok)),
      ...parsePlatformOrders(source, "shopee", table(SALES_TABS.shopee)),
    ],
    cashEntries,
    pendingCards: parsePendingCards(
      source,
      findTab(source, SALES_TABS.pendingCards),
    ),
    cashbook: parseCashbook(source, findTab(source, SALES_TABS.cashbook)),
    fundSummaries: parseFundSummaries(
      source,
      findTab(source, SALES_TABS.cashbook),
    ),
    inventory: parseInventory(source, findTab(source, SALES_TABS.inventory)),
    supplierLedger: [
      ...parseSupplierLedger(
        source,
        findTab(source, SALES_TABS.supplierDebts),
      ).filter((e) => e.kind !== "payment"),
      ...ledgerFromCashEntries(cashEntries),
    ],
    catalog: parseCatalog(findCatalogTab(source)),
    pnl: [],
    dailyBooks: [],
    supplierInfo: [],
    paymentSchedule: [],
    stock: [],
    purchaseOrders: [],
    receipts: [],
  };
};

/** Units whose BCTC file has a supplier ledger: payments derived from Bảng Chi phí are dropped there. */
const mergeLedgers = (datasets: Dataset[]): SupplierEntry[] => {
  const all = datasets.flatMap((d) => d.supplierLedger);
  const fromBctc = new Set(
    all
      .filter((e) => e.note !== "Bảng Chi phí")
      .map((e) => `${e.branch}-${e.line}`),
  );
  return all.filter(
    (e) => e.note !== "Bảng Chi phí" || !fromBctc.has(`${e.branch}-${e.line}`),
  );
};

export const mergeDatasets = (datasets: Dataset[]): Dataset => ({
  orders: datasets.flatMap((d) => d.orders),
  platformOrders: datasets.flatMap((d) => d.platformOrders),
  cashEntries: datasets.flatMap((d) => d.cashEntries),
  pendingCards: datasets.flatMap((d) => d.pendingCards),
  cashbook: datasets.flatMap((d) => d.cashbook),
  fundSummaries: datasets.flatMap((d) => d.fundSummaries),
  inventory: datasets.flatMap((d) => d.inventory),
  supplierLedger: mergeLedgers(datasets),
  catalog: mergeCatalogs(datasets.map((d) => d.catalog)),
  pnl: datasets.flatMap((d) => d.pnl),
  dailyBooks: datasets.flatMap((d) => d.dailyBooks),
  supplierInfo: datasets.flatMap((d) => d.supplierInfo),
  paymentSchedule: datasets.flatMap((d) => d.paymentSchedule),
  stock: datasets.flatMap((d) => d.stock),
  purchaseOrders: datasets.flatMap((d) => d.purchaseOrders),
  receipts: datasets.flatMap((d) => d.receipts),
});

export const CHANNEL_LABELS: Record<Channel, string> = {
  store: "Tại cửa hàng",
  local: "Ship nội thành",
  post: "Bưu điện",
  tiktok: "TikTok",
  shopee: "Shopee",
};
