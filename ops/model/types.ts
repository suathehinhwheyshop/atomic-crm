export type BranchCode = "HN" | "SG" | "VINH" | "DN";
export type GoodsLine = "HCT" | "HXT";

export type Channel = "store" | "local" | "post" | "tiktok" | "shopee";

export type OrderItem = {
  product: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type Order = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  channel: Channel;
  date: string; // yyyy-mm-dd
  shift: string;
  staff: string;
  code: string;
  source: string;
  customer: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  shippingFee: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryStatus: string;
  postType: string;
  cash: number;
  bank: number;
  card: number;
  cod: number;
  check: string;
  inCashbook: boolean;
  /** Revenue counted by the sheet rules (delivered local orders, new post orders...). */
  revenue: number;
};

export type PlatformOrder = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  channel: "tiktok" | "shopee";
  date: string;
  code: string;
  revenue: number;
  netRevenue: number;
  fee: number;
  check: string;
};

export type CashEntry = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  kind: string; // Chi / Thu khác
  group: string;
  description: string;
  amount: number;
  fund: string;
  targetFund: string;
  check: string;
  spender: string;
  voucher: string;
};

export type PendingCard = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  source: string;
  code: string;
  amount: number;
  waitingDays: number;
};

export type Dataset = {
  orders: Order[];
  platformOrders: PlatformOrder[];
  cashEntries: CashEntry[];
  pendingCards: PendingCard[];
};

/** Raw values of one spreadsheet, keyed by tab title (as returned by the Sheets API). */
export type WorkbookValues = Record<string, string[][]>;

export type WorkbookSource = {
  branch: BranchCode;
  line: GoodsLine;
  tabs: WorkbookValues;
};
