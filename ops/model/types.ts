import type { Product } from "./catalog";
import type { SupplierEntry } from "./supplierLedger";

export type BranchCode = "HN" | "HCM" | "VINH" | "DN";
/** HCT = company goods, HXT = hand-carried goods, GOP = one merged file (Vinh, Da Nang). */
export type GoodsLine = "HCT" | "HXT" | "GOP";

export type Channel = "store" | "local" | "post" | "tiktok" | "shopee";

export type OrderItem = {
  product: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Set by the product catalog when the typed name is recognised. */
  productCode?: string;
  canonicalName?: string;
  costPrice?: number;
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

/** One line of the Sổ quỹ tab: running balances after the movement. */
export type CashbookRow = {
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  cashBalance: number;
  bankBalance: number;
  pendingCardBalance: number;
};

/** Summary block of the Sổ quỹ tab (rows 6-7). */
export type FundSummary = {
  branch: BranchCode;
  line: GoodsLine;
  fund: "cash" | "bank";
  opening: number;
  closing: number;
  actual: number | null;
  closingDate: string;
};

/** Row of the "Tồn kho" tab (proposed): Ngày | Mã SP | Sản phẩm | Tồn | Tồn tối thiểu. */
export type InventoryItem = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  productCode: string;
  product: string;
  quantity: number;
  unit: string;
  costPrice: number;
  minimum: number;
  updatedAt: string;
};

export type Dataset = {
  orders: Order[];
  platformOrders: PlatformOrder[];
  cashEntries: CashEntry[];
  pendingCards: PendingCard[];
  cashbook: CashbookRow[];
  fundSummaries: FundSummary[];
  inventory: InventoryItem[];
  supplierLedger: SupplierEntry[];
  catalog: Product[];
  pnl: PnlLine[];
  dailyBooks: DailyBook[];
  supplierInfo: SupplierInfo[];
  paymentSchedule: PaymentSchedule[];
  stock: StockRow[];
  purchaseOrders: PurchaseOrderLine[];
  receipts: ReceiptLine[];
};

/** Raw values of one spreadsheet, keyed by tab title (as returned by the Sheets API). */
export type WorkbookValues = Record<string, string[][]>;

/** sales = "Báo cáo bán hàng", bctc = "BCTC", kho = "Hàng hóa - Kho", price = "Bảng giá". */
export type WorkbookKind = "sales" | "bctc" | "kho" | "price";

export type WorkbookSource = {
  branch: BranchCode;
  line: GoodsLine;
  kind?: WorkbookKind;
  tabs: WorkbookValues;
};

/** One line of the monthly P&L tab ("BCTC tháng" / "Báo cáo tài chính"): 12 month values. */
export type PnlLine = {
  branch: BranchCode;
  line: GoodsLine;
  section: string; // "I. CỬA HÀNG…", "II. TIKTOK", …
  label: string;
  months: number[]; // index 0 = January
  total: number;
  emphasis: boolean; // numbered lines ("1. DOANH THU", "5. LỢI NHUẬN…") and totals
};

/** One day of the "DT ngày" / "Doanh thu ngày" tab: Sapo revenue and cost of goods per channel. */
export type DailyBook = {
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  revenueStore: number;
  revenueLocal: number;
  revenuePost: number;
  costStore: number;
  costLocal: number;
  costPost: number;
  check: string;
};

export type SupplierInfo = {
  branch: BranchCode;
  line: GoodsLine;
  supplier: string;
  company: string;
  bank: string;
};

/** "Lịch TT NCC": amounts due per supplier and branch, what was paid, what is still missing. */
export type PaymentSchedule = {
  key: string;
  branch: BranchCode;
  line: GoodsLine;
  date: string;
  supplier: string;
  note: string;
  due: number;
  paid: number;
  remaining: number;
  method: string;
};

/** "Hàng xách tay tồn kho" row. */
export type StockRow = {
  key: string;
  branch: BranchCode;
  product: string;
  opening: number;
  received: number;
  sold: number;
  transferred: number;
  closing: number;
  expiry: string;
  minimum: number;
  warning: string;
};

/** "Hàng công ty đã đặt" row (one product of one purchase order). */
export type PurchaseOrderLine = {
  key: string;
  branch: BranchCode;
  date: string;
  po: string;
  supplier: string;
  product: string;
  ordered: number;
  unitPrice: number;
  expected: string;
  received: number;
  missing: number;
  status: string;
  cancelled: boolean;
};

/** "Hàng công ty mới về" row. */
export type ReceiptLine = {
  key: string;
  branch: BranchCode;
  date: string;
  po: string;
  supplier: string;
  product: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  expiry: string;
};
