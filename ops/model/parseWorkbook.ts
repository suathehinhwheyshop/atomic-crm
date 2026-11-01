import { findCatalogTab, mergeCatalogs, parseCatalog } from "./catalog";
import {
  parseCashbook,
  parseFundSummaries,
  parseInventory,
} from "./parseExtras";
import { parseSupplierLedger } from "./supplierLedger";
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

const TAB_PREFIX = {
  store: "Đơn CH",
  local: "Đơn NT",
  post: "Đơn Bưu điện",
  tiktok: "Đơn Tiktok",
  shopee: "Đơn Shopee",
  expenses: "Bảng Chi phí",
  pendingCards: "MPOS về",
  cashbook: "Sổ quỹ",
  inventory: "Tồn kho",
  supplierDebts: "Công nợ NCC",
} as const;

const findTab = (source: WorkbookSource, prefix: string) =>
  Object.entries(source.tabs).find(([title]) => title.startsWith(prefix))?.[1];

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
      quantity: parseAmount(get(row, "SL")),
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
    const total = parseAmount(get(row, "Tổng tiền khách trả"));
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
      phone: normalizePhone(get(row, "SĐT")),
      address: get(row, "Địa chỉ"),
      items: item.product ? [item] : [],
      total,
      shippingFee: parseAmount(get(row, "Phí ship thu khách")),
      paymentMethod: get(row, "Hình thức TT"),
      paymentStatus: get(row, "Trạng thái TT"),
      deliveryStatus: channel === "store" ? "Đã giao" : deliveryStatus,
      postType: "",
      cash: parseAmount(get(row, "Tiền mặt (tự tính)")),
      bank: parseAmount(get(row, "CK ")),
      card: parseAmount(get(row, "MPOS (tự tính)")),
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
    const paid = get(row, "Trạng thái TT") === "Đã thanh toán";
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
      phone: normalizePhone(get(row, "SĐT")),
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
      paymentStatus: get(row, "Trạng thái TT"),
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

/** "MPOS về ..." tab: the auto-filled pending list sits in columns E–I under a 4-row header. */
const parsePendingCards = (
  source: WorkbookSource,
  values: string[][] | undefined,
): PendingCard[] =>
  (values ?? []).slice(4).flatMap((row, index) => {
    const [dateCell, sourceCell, code, amount, days] = row.slice(4, 9);
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

export const parseWorkbook = (source: WorkbookSource): Dataset => {
  const table = (prefix: string) => readTable(findTab(source, prefix));
  const channels: Array<["store" | "local", string]> = [
    ["store", TAB_PREFIX.store],
    ["local", TAB_PREFIX.local],
  ];
  return {
    orders: [
      ...channels.flatMap(([channel, prefix]) =>
        parseItemOrders(source, channel, table(prefix)),
      ),
      ...parsePostOrders(source, table(TAB_PREFIX.post)),
    ],
    platformOrders: [
      ...parsePlatformOrders(source, "tiktok", table(TAB_PREFIX.tiktok)),
      ...parsePlatformOrders(source, "shopee", table(TAB_PREFIX.shopee)),
    ],
    cashEntries: parseCashEntries(source, table(TAB_PREFIX.expenses)),
    pendingCards: parsePendingCards(
      source,
      findTab(source, TAB_PREFIX.pendingCards),
    ),
    cashbook: parseCashbook(source, findTab(source, TAB_PREFIX.cashbook)),
    fundSummaries: parseFundSummaries(
      source,
      findTab(source, TAB_PREFIX.cashbook),
    ),
    inventory: parseInventory(source, findTab(source, TAB_PREFIX.inventory)),
    supplierLedger: parseSupplierLedger(
      source,
      findTab(source, TAB_PREFIX.supplierDebts),
    ),
    catalog: parseCatalog(findCatalogTab(source)),
  };
};

export const mergeDatasets = (datasets: Dataset[]): Dataset => ({
  orders: datasets.flatMap((d) => d.orders),
  platformOrders: datasets.flatMap((d) => d.platformOrders),
  cashEntries: datasets.flatMap((d) => d.cashEntries),
  pendingCards: datasets.flatMap((d) => d.pendingCards),
  cashbook: datasets.flatMap((d) => d.cashbook),
  fundSummaries: datasets.flatMap((d) => d.fundSummaries),
  inventory: datasets.flatMap((d) => d.inventory),
  supplierLedger: datasets.flatMap((d) => d.supplierLedger),
  catalog: mergeCatalogs(datasets.map((d) => d.catalog)),
});

export const CHANNEL_LABELS: Record<Channel, string> = {
  store: "Tại cửa hàng",
  local: "Ship nội thành",
  post: "Bưu điện",
  tiktok: "TikTok",
  shopee: "Shopee",
};
