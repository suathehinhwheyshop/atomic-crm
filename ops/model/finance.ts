// Period summaries for the finance section: opening / movements / closing of the
// cash funds and of supplier debt, revenue per channel, and money not yet in the
// cashbook (mirrors the "Đơn chưa vào Sổ quỹ" block of the Tổng hợp thu chi tab).
import { summarizeChannels, type ChannelSummary } from "./metrics";
import { unitKey, type BranchUnit } from "./reports";
import { supplierBalances, type SupplierEntry } from "./supplierLedger";
import type { CashbookRow, Channel, Dataset } from "./types";

const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);
const isOk = (check: string) => check.startsWith("OK");

export type FundPeriod = {
  unit: BranchUnit;
  fund: "cash" | "bank";
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  actual: number | null;
  closingDate: string;
};

/** Opening = balance of the last row before `from` (or the first row's balance minus its own movements). */
export const fundPeriods = (
  data: Dataset,
  units: BranchUnit[],
  from: string,
  to: string,
): FundPeriod[] =>
  units.flatMap((unit) => {
    const rows = data.cashbook
      .filter((r) => unitKey(r) === unit.key && (!to || r.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) return [];
    const before = rows.filter((r) => r.date < from).at(-1);
    const inPeriod = rows.filter((r) => r.date >= from);
    const last = rows.at(-1)!;
    const first = inPeriod[0];
    const build = (
      fund: "cash" | "bank",
      pick: (r: CashbookRow) => [number, number, number],
    ): FundPeriod => {
      const [, firstIn, firstOut] = first ? pick(first) : [0, 0, 0];
      const opening = before
        ? pick(before)[0]
        : first
          ? pick(first)[0] - firstIn + firstOut
          : 0;
      const summary = data.fundSummaries.find(
        (s) => unitKey(s) === unit.key && s.fund === fund,
      );
      return {
        unit,
        fund,
        opening,
        inflow: sum(inPeriod, (r) => pick(r)[1]),
        outflow: sum(inPeriod, (r) => pick(r)[2]),
        closing: pick(last)[0],
        actual:
          summary?.closingDate && summary.closingDate === last.date
            ? summary.actual
            : null,
        closingDate: last.date,
      };
    };
    return [
      build("cash", (r) => [r.cashBalance, r.cashIn, r.cashOut]),
      build("bank", (r) => [r.bankBalance, r.bankIn, r.bankOut]),
    ];
  });

export type DebtPeriod = {
  unit: BranchUnit;
  suppliers: number;
  opening: number;
  purchased: number;
  paid: number;
  closing: number;
  overdue: number;
};

const signed = (e: SupplierEntry) =>
  e.kind === "payment" ? -e.amount : e.amount;

export const debtPeriods = (
  data: Dataset,
  units: BranchUnit[],
  from: string,
  to: string,
  today: string,
): DebtPeriod[] =>
  units.flatMap((unit) => {
    const entries = data.supplierLedger.filter(
      (e) => unitKey(e) === unit.key && (!to || e.date <= to),
    );
    if (!entries.length) return [];
    const inPeriod = entries.filter((e) => e.date >= from);
    const balances = supplierBalances(entries, today);
    return [
      {
        unit,
        suppliers: new Set(entries.map((e) => e.supplier)).size,
        opening: sum(
          entries.filter((e) => e.date < from),
          signed,
        ),
        purchased: sum(
          inPeriod.filter((e) => e.kind !== "payment"),
          (e) => e.amount,
        ),
        paid: sum(
          inPeriod.filter((e) => e.kind === "payment"),
          (e) => e.amount,
        ),
        closing: sum(balances, (b) => b.balance),
        overdue: sum(balances, (b) => b.overdue30 + b.overdue90),
      },
    ];
  });

export type ChannelByUnit = {
  unit: BranchUnit;
  channels: ChannelSummary[];
  total: number;
};

export const channelsByUnit = (
  data: Dataset,
  units: BranchUnit[],
): ChannelByUnit[] =>
  units.map((unit) => {
    const scoped: Dataset = {
      ...data,
      orders: data.orders.filter((o) => unitKey(o) === unit.key),
      platformOrders: data.platformOrders.filter(
        (o) => unitKey(o) === unit.key,
      ),
    };
    const channels = summarizeChannels(scoped);
    return { unit, channels, total: sum(channels, (c) => c.revenue) };
  });

export type PendingMoney = {
  unit: BranchUnit;
  localUnpaid: number; // delivered local orders not yet paid, or paid but check not OK
  postNotDelivered: number; // post orders still on the way (new orders)
  codCollected: number; // COD paid by the post office, not yet booked as "Thu khác"
  platformNet: number; // platform net revenue not yet booked as "DOANH THU SÀN"
  pendingCards: number; // MPOS waiting for the bank
  orderIssues: number; // store / local orders with a failed check
};

const bookedIncome = (data: Dataset, unit: BranchUnit, group: string) =>
  sum(
    data.cashEntries.filter(
      (e) =>
        unitKey(e) === unit.key &&
        e.kind !== "Chi" &&
        e.group === group &&
        isOk(e.check),
    ),
    (e) => e.amount,
  );

/** Money earned in the period that has not reached the cashbook yet. */
export const pendingMoney = (
  data: Dataset,
  units: BranchUnit[],
): PendingMoney[] =>
  units.map((unit) => {
    const orders = data.orders.filter((o) => unitKey(o) === unit.key);
    const post = orders.filter((o) => o.channel === "post");
    const platform = data.platformOrders.filter(
      (o) => unitKey(o) === unit.key && isOk(o.check),
    );
    const codCollected = sum(
      post.filter((o) => o.cod > 0 && o.paymentStatus === "Đã thanh toán"),
      (o) => o.cod,
    );
    return {
      unit,
      localUnpaid: sum(
        orders.filter(
          (o) =>
            o.channel === "local" &&
            o.deliveryStatus === "Đã giao" &&
            !o.inCashbook,
        ),
        (o) => o.total,
      ),
      postNotDelivered: sum(
        post.filter(
          (o) =>
            o.postType !== "Hoàn" &&
            o.deliveryStatus !== "Đã giao" &&
            o.deliveryStatus !== "Hoàn-Huỷ",
        ),
        (o) => o.total,
      ),
      codCollected: Math.max(
        0,
        codCollected - bookedIncome(data, unit, "ĐƠN TỈNH - BƯU ĐIỆN"),
      ),
      platformNet: Math.max(
        0,
        sum(platform, (o) => o.netRevenue) -
          bookedIncome(data, unit, "DOANH THU SÀN"),
      ),
      pendingCards: sum(
        data.pendingCards.filter((p) => unitKey(p) === unit.key),
        (p) => p.amount,
      ),
      orderIssues: sum(
        orders.filter((o) => o.channel !== "post" && !isOk(o.check)),
        (o) => o.total,
      ),
    };
  });

export const CHANNEL_ORDER: Channel[] = [
  "store",
  "local",
  "post",
  "tiktok",
  "shopee",
];
