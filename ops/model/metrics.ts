import { isOperatingExpense } from "./reports";
import type {
  BranchCode,
  CashEntry,
  Channel,
  Dataset,
  GoodsLine,
  Order,
} from "./types";

export type Filters = {
  branch: BranchCode | "ALL";
  line: GoodsLine | "ALL";
  from: string; // yyyy-mm-dd, inclusive
  to: string; // yyyy-mm-dd, inclusive
};

type Scoped = { branch: BranchCode; line: GoodsLine; date: string };

const inScope = (filters: Filters) => (record: Scoped) =>
  (filters.branch === "ALL" || record.branch === filters.branch) &&
  (filters.line === "ALL" || record.line === filters.line) &&
  (!filters.from || record.date >= filters.from) &&
  (!filters.to || record.date <= filters.to);

export const filterDataset = (data: Dataset, filters: Filters): Dataset => {
  const keep = inScope(filters);
  const keepSnapshot = (r: { branch: BranchCode; line: GoodsLine }) =>
    (filters.branch === "ALL" || r.branch === filters.branch) &&
    (filters.line === "ALL" || r.line === filters.line);
  return {
    orders: data.orders.filter(keep),
    platformOrders: data.platformOrders.filter(keep),
    cashEntries: data.cashEntries.filter(keep),
    // Live snapshots (pending cards, stock, debts, fund summary): scope by branch/line only.
    pendingCards: data.pendingCards.filter(keepSnapshot),
    cashbook: data.cashbook.filter(keep),
    fundSummaries: data.fundSummaries.filter(keepSnapshot),
    inventory: data.inventory.filter(keepSnapshot),
    supplierDebts: data.supplierDebts.filter(keepSnapshot),
  };
};

const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

const isOk = (check: string) => check.startsWith("OK");

export type ChannelSummary = {
  channel: Channel;
  orders: number;
  revenue: number;
  cash: number;
  bank: number;
  card: number;
  cod: number;
};

export const summarizeChannels = (data: Dataset): ChannelSummary[] => {
  const orderChannels: Channel[] = ["store", "local", "post"];
  const fromOrders = orderChannels.map((channel) => {
    const counted = data.orders.filter(
      (o) => o.channel === channel && o.revenue > 0,
    );
    return {
      channel,
      orders: counted.length,
      revenue: sum(counted, (o) => o.revenue),
      cash: sum(counted, (o) => o.cash),
      bank: sum(counted, (o) => o.bank),
      card: sum(counted, (o) => o.card),
      cod: sum(counted, (o) => o.cod),
    };
  });
  const platforms = (["tiktok", "shopee"] as const).map((channel) => {
    const counted = data.platformOrders.filter(
      (o) => o.channel === channel && isOk(o.check),
    );
    return {
      channel,
      orders: counted.length,
      revenue: sum(counted, (o) => o.revenue),
      cash: 0,
      bank: sum(counted, (o) => o.netRevenue),
      card: 0,
      cod: 0,
    };
  });
  return [...fromOrders, ...platforms];
};

export type Kpis = {
  revenue: number;
  orders: number;
  averageOrder: number;
  customers: number;
  cash: number;
  bank: number;
  card: number;
  cod: number;
  pendingCards: number;
  expenses: number;
};

export const computeKpis = (data: Dataset): Kpis => {
  const channels = summarizeChannels(data);
  const revenue = sum(channels, (c) => c.revenue);
  const orders = sum(channels, (c) => c.orders);
  return {
    revenue,
    orders,
    averageOrder: orders ? Math.round(revenue / orders) : 0,
    customers: buildCustomers(data.orders).length,
    cash: sum(channels, (c) => c.cash),
    bank: sum(channels, (c) => c.bank),
    card: sum(channels, (c) => c.card),
    cod: sum(channels, (c) => c.cod),
    pendingCards: sum(data.pendingCards, (p) => p.amount),
    expenses: sum(data.cashEntries.filter(isOperatingExpense), (e) => e.amount),
  };
};

export type DailyRevenue = { date: string } & Record<Channel, number>;

export const revenueByDay = (data: Dataset): DailyRevenue[] => {
  const days = new Map<string, DailyRevenue>();
  const add = (date: string, channel: Channel, amount: number) => {
    const day = days.get(date) ?? {
      date,
      store: 0,
      local: 0,
      post: 0,
      tiktok: 0,
      shopee: 0,
    };
    days.set(date, { ...day, [channel]: day[channel] + amount });
  };
  data.orders
    .filter((o) => o.revenue > 0)
    .forEach((o) => add(o.date, o.channel, o.revenue));
  data.platformOrders
    .filter((o) => isOk(o.check))
    .forEach((o) => add(o.date, o.channel, o.revenue));
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
};

export type ShiftRow = {
  date: string;
  staff: string;
  shift: string;
  channel: Channel;
  orders: number;
  revenue: number;
  cash: number;
  bank: number;
  card: number;
  cod: number;
  issues: number;
};

/** Same grouping as the "Tổng hợp ca" tab: date + staff + channel. */
export const shiftSummary = (orders: Order[]): ShiftRow[] => {
  const rows = new Map<string, ShiftRow>();
  for (const o of orders) {
    const staff = o.staff || "(Chưa ghi NV)";
    const id = `${o.date}|${staff}|${o.channel}`;
    const row = rows.get(id) ?? {
      date: o.date,
      staff,
      shift: o.shift || "(Chưa ghi ca)",
      channel: o.channel,
      orders: 0,
      revenue: 0,
      cash: 0,
      bank: 0,
      card: 0,
      cod: 0,
      issues: 0,
    };
    const counted = o.revenue > 0;
    rows.set(id, {
      ...row,
      orders: row.orders + (counted ? 1 : 0),
      revenue: row.revenue + o.revenue,
      cash: row.cash + (counted ? o.cash : 0),
      bank: row.bank + (counted ? o.bank : 0),
      card: row.card + (counted ? o.card : 0),
      cod: row.cod + (counted ? o.cod : 0),
      issues: row.issues + (isOrderIssue(o) ? 1 : 0),
    });
  }
  return [...rows.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.staff.localeCompare(b.staff),
  );
};

export type StaffTotal = { staff: string; orders: number; revenue: number };

export const staffTotals = (rows: ShiftRow[]): StaffTotal[] => {
  const totals = new Map<string, StaffTotal>();
  rows.forEach((r) => {
    const t = totals.get(r.staff) ?? { staff: r.staff, orders: 0, revenue: 0 };
    totals.set(r.staff, {
      ...t,
      orders: t.orders + r.orders,
      revenue: t.revenue + r.revenue,
    });
  });
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
};

export type CustomerSegment = "VIP" | "Quay lại" | "Mới";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  orders: Order[];
  orderCount: number;
  spent: number;
  firstDate: string;
  lastDate: string;
  channels: Channel[];
  branches: BranchCode[];
  topProduct: string;
  segment: CustomerSegment;
};

const VIP_MIN_SPENT = 10_000_000;

/** Customers are identified by phone number (name when the phone is missing). */
export const buildCustomers = (orders: Order[]): Customer[] => {
  const groups = new Map<string, Order[]>();
  orders.forEach((o) => {
    const id = o.phone || `name:${o.customer.toLowerCase()}`;
    if (!o.phone && !o.customer) return;
    groups.set(id, [...(groups.get(id) ?? []), o]);
  });
  return [...groups.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const spent = sum(sorted, (o) => o.revenue);
      const productCount = new Map<string, number>();
      sorted
        .flatMap((o) => o.items)
        .forEach((i) =>
          productCount.set(
            i.product,
            (productCount.get(i.product) ?? 0) + i.quantity,
          ),
        );
      const topProduct =
        [...productCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const orderCount = sorted.length;
      return {
        id,
        name: sorted.at(-1)!.customer || "(Không tên)",
        phone: sorted.at(-1)!.phone,
        orders: sorted.reverse(),
        orderCount,
        spent,
        firstDate: sorted.at(-1)!.date,
        lastDate: sorted[0].date,
        channels: [...new Set(sorted.map((o) => o.channel))],
        branches: [...new Set(sorted.map((o) => o.branch))],
        topProduct,
        segment: (spent >= VIP_MIN_SPENT
          ? "VIP"
          : orderCount > 1
            ? "Quay lại"
            : "Mới") as CustomerSegment,
      };
    })
    .sort((a, b) => b.spent - a.spent);
};

export type ProductTotal = {
  product: string;
  quantity: number;
  amount: number;
};

export const topProducts = (orders: Order[], limit = 8): ProductTotal[] => {
  const totals = new Map<string, ProductTotal>();
  orders
    .filter((o) => o.revenue > 0)
    .flatMap((o) => o.items)
    .filter((i) => i.product && i.unitPrice > 0)
    .forEach((i) => {
      const t = totals.get(i.product) ?? {
        product: i.product,
        quantity: 0,
        amount: 0,
      };
      totals.set(i.product, {
        ...t,
        quantity: t.quantity + i.quantity,
        amount: t.amount + i.quantity * i.unitPrice - i.discount,
      });
    });
  return [...totals.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};

export type GroupTotal = {
  group: string;
  kind: string;
  amount: number;
  rows: number;
};

export const cashByGroup = (entries: CashEntry[]): GroupTotal[] => {
  const totals = new Map<string, GroupTotal>();
  entries
    .filter((e) => isOk(e.check))
    .forEach((e) => {
      const t = totals.get(e.group) ?? {
        group: e.group,
        kind: e.kind === "Chi" ? "Chi" : "Thu",
        amount: 0,
        rows: 0,
      };
      totals.set(e.group, {
        ...t,
        amount: t.amount + e.amount,
        rows: t.rows + 1,
      });
    });
  return [...totals.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || b.amount - a.amount,
  );
};

export type FundFlow = { fund: string; inflow: number; outflow: number };

/** Movements in the period per fund (opening balances live in the Sổ quỹ tab). */
export const fundFlows = (data: Dataset): FundFlow[] => {
  const flows = new Map<string, FundFlow>();
  const add = (fund: string, inflow: number, outflow: number) => {
    const f = flows.get(fund) ?? { fund, inflow: 0, outflow: 0 };
    flows.set(fund, {
      fund,
      inflow: f.inflow + inflow,
      outflow: f.outflow + outflow,
    });
  };
  data.orders
    .filter((o) => o.inCashbook)
    .forEach((o) => {
      if (o.cash) add("Tiền mặt", o.cash, 0);
      if (o.bank) add("Ngân hàng (BIDV/MB)", o.bank, 0);
      if (o.card) add("Quẹt thẻ (MPOS)", o.card, 0);
    });
  data.cashEntries
    .filter((e) => isOk(e.check))
    .forEach((e) => {
      const fund = e.fund === "Tiền mặt" ? "Tiền mặt" : "Ngân hàng (BIDV/MB)";
      if (e.kind === "Chi") add(fund, 0, e.amount);
      else add(fund, e.amount, 0);
    });
  return [...flows.values()];
};

export type Alert = {
  key: string;
  level: "error" | "warning";
  title: string;
  detail: string;
  branch: BranchCode;
  line: GoodsLine;
  date: string;
};

const isOrderIssue = (o: Order) => !isOk(o.check);

export const buildAlerts = (data: Dataset, today: string): Alert[] => {
  const daysBetween = (from: string) =>
    Math.round((Date.parse(today) - Date.parse(from)) / 86_400_000);
  const alerts: Alert[] = [];
  data.orders.forEach((o) => {
    const base = { branch: o.branch, line: o.line, date: o.date };
    if (isOrderIssue(o)) {
      alerts.push({
        ...base,
        key: `issue-${o.key}`,
        level: "error",
        title: `Đơn ${o.code}: ${o.check || "thiếu kiểm tra"}`,
        detail: `${o.customer || "(không tên)"} · chưa vào Sổ quỹ`,
      });
    }
    if (
      o.channel === "local" &&
      !["Đã giao", "Hoàn-Huỷ"].includes(o.deliveryStatus) &&
      daysBetween(o.date) >= 2
    ) {
      alerts.push({
        ...base,
        key: `late-${o.key}`,
        level: "warning",
        title: `Đơn nội thành ${o.code} chưa giao sau ${daysBetween(o.date)} ngày`,
        detail: `Trạng thái: ${o.deliveryStatus || "trống"}`,
      });
    }
    if (
      o.channel === "post" &&
      o.postType === "Mới" &&
      o.paymentStatus !== "Đã thanh toán" &&
      daysBetween(o.date) >= 7
    ) {
      alerts.push({
        ...base,
        key: `cod-${o.key}`,
        level: "warning",
        title: `Bưu điện ${o.code} chưa thu tiền sau ${daysBetween(o.date)} ngày`,
        detail: `${o.paymentMethod} · ${o.deliveryStatus}`,
      });
    }
    if (
      o.deliveryStatus === "Hoàn-Huỷ" &&
      o.paymentStatus === "Đã thanh toán"
    ) {
      alerts.push({
        ...base,
        key: `refund-${o.key}`,
        level: "warning",
        title: `Đơn ${o.code} huỷ nhưng đã thanh toán`,
        detail: "Kiểm tra dòng Chi HOÀN TIỀN KHÁCH ở Bảng Chi phí",
      });
    }
  });
  data.pendingCards
    .filter((p) => p.waitingDays >= 3)
    .forEach((p) =>
      alerts.push({
        key: `card-${p.key}`,
        level: "error",
        title: `MPOS ${p.code} chờ tiền về ${p.waitingDays} ngày`,
        detail: `${p.source} · nhập ngày tiền về ở tab MPOS`,
        branch: p.branch,
        line: p.line,
        date: p.date,
      }),
    );
  data.platformOrders
    .filter((p) => !isOk(p.check))
    .forEach((p) =>
      alerts.push({
        key: `platform-${p.key}`,
        level: "error",
        title: `Đơn sàn ${p.code}: ${p.check || "chưa kiểm tra"}`,
        detail: p.channel === "tiktok" ? "TikTok" : "Shopee",
        branch: p.branch,
        line: p.line,
        date: p.date,
      }),
    );
  data.cashEntries
    .filter((e) => !isOk(e.check))
    .forEach((e) =>
      alerts.push({
        key: `cash-${e.key}`,
        level: "error",
        title: `Chi phí ${e.voucher || ""}: ${e.check || "chưa kiểm tra"}`,
        detail: e.description,
        branch: e.branch,
        line: e.line,
        date: e.date,
      }),
    );
  return alerts.sort((a, b) => b.date.localeCompare(a.date));
};
