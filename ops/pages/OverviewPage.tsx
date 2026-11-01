import {
  AlertTriangle,
  CreditCard,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCompact, formatDate, formatVnd } from "../components/format";
import { Kpi } from "../components/Kpi";
import { ChannelLegend, RevenueChart } from "../components/RevenueChart";
import { useScopedData } from "../components/useScopedData";
import {
  buildAlerts,
  computeKpis,
  revenueByDay,
  shiftSummary,
  staffTotals,
  summarizeChannels,
} from "../model/metrics";
import { CHANNEL_LABELS } from "../model/parseWorkbook";
import { pendingMoney } from "../model/finance";
import { branchUnits, financialStatement } from "../model/reports";
import { UnitLabel } from "../components/UnitLabel";

export const OverviewPage = () => {
  const { loaded, scoped } = useScopedData();
  const view = useMemo(() => {
    if (!scoped || !loaded) return null;
    const channels = summarizeChannels(scoped);
    return {
      kpis: computeKpis(scoped),
      channels,
      days: revenueByDay(scoped),
      pending: pendingMoney(scoped, branchUnits(scoped)),
      staff: staffTotals(shiftSummary(scoped.orders)).slice(0, 6),
      alerts: buildAlerts(scoped, loaded.today),
      branches: financialStatement(scoped, branchUnits(scoped)),
    };
  }, [scoped, loaded]);
  if (!view) return null;
  const { kpis, channels, days, pending, staff, alerts, branches } = view;
  const pendingTotal = pending.reduce(
    (t, p) =>
      t +
      p.localUnpaid +
      p.postNotDelivered +
      p.codCollected +
      p.platformNet +
      p.pendingCards,
    0,
  );
  const totals = channels.reduce(
    (t, c) => ({
      orders: t.orders + c.orders,
      revenue: t.revenue + c.revenue,
      cash: t.cash + c.cash,
      bank: t.bank + c.bank,
      card: t.card + c.card,
      cod: t.cod + c.cod,
    }),
    { orders: 0, revenue: 0, cash: 0, bank: 0, card: 0, cod: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          icon={<TrendingUp className="size-4" />}
          label="Doanh thu"
          value={formatCompact(kpis.revenue)}
          hint={formatVnd(kpis.revenue)}
        />
        <Kpi
          icon={<ShoppingBag className="size-4" />}
          label="Số đơn tính doanh thu"
          value={kpis.orders.toLocaleString("vi-VN")}
          hint={`TB ${formatCompact(kpis.averageOrder)}/đơn`}
        />
        <Kpi
          icon={<Users className="size-4" />}
          label="Khách hàng"
          value={kpis.customers.toLocaleString("vi-VN")}
          hint="Gộp theo số điện thoại"
        />
        <Kpi
          icon={<Wallet className="size-4" />}
          label="Tiền mặt thu"
          value={formatCompact(kpis.cash)}
          hint={`Chuyển khoản ${formatCompact(kpis.bank)}`}
        />
        <Kpi
          icon={<CreditCard className="size-4" />}
          label="MPOS chờ về"
          value={formatCompact(kpis.pendingCards)}
          hint="Chưa cộng vào ngân hàng"
          tone={kpis.pendingCards ? "warning" : "default"}
        />
        <Kpi
          icon={<Receipt className="size-4" />}
          label="Chi phí"
          value={formatCompact(kpis.expenses)}
          hint="Vận hành, không gồm trả NCC"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theo chi nhánh trong kỳ</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Chi phí vận hành</TableHead>
                <TableHead className="text-right">
                  Doanh thu − Chi phí
                </TableHead>
                <TableHead className="text-right">Tồn quỹ cuối kỳ</TableHead>
                <TableHead className="text-right">Nợ NCC cuối kỳ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.unit.key}>
                  <TableCell>
                    <UnitLabel unit={b.unit} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVnd(b.revenue)}
                  </TableCell>
                  <TableCell className="text-right">{b.orders}</TableCell>
                  <TableCell className="text-right">
                    {formatVnd(b.expenses)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(b.revenue - b.expenses)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(b.cash + b.bank)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatVnd(b.debtBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Doanh thu theo ngày và kênh</CardTitle>
          <ChannelLegend />
        </CardHeader>
        <CardContent>
          <RevenueChart days={days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo kênh</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kênh</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Tiền mặt</TableHead>
                <TableHead className="text-right">Chuyển khoản</TableHead>
                <TableHead className="text-right">Quẹt thẻ</TableHead>
                <TableHead className="text-right">COD</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((c) => (
                <TableRow key={c.channel}>
                  <TableCell className="font-medium">
                    {CHANNEL_LABELS[c.channel]}
                  </TableCell>
                  <TableCell className="text-right">{c.orders}</TableCell>
                  <TableCell className="text-right">
                    {formatVnd(c.cash)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(c.bank)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(c.card)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(c.cod)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVnd(c.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                <TableCell className="text-right">{totals.orders}</TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.cash)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.bank)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.card)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.cod)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.revenue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Quy tắc như file báo cáo: nội thành chỉ tính đơn Đã giao; Bưu điện
            Đã giao + Mới tính đủ, Gửi lại chỉ tính phí ship; sàn chỉ tính dòng
            Hệ thống = OK (cột Chuyển khoản là tiền thực nhận sau phí sàn).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>
              Tiền chưa vào Sổ quỹ · {formatCompact(pendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              [
                "Nội thành đã giao chưa thu",
                pending.reduce((t, p) => t + p.localUnpaid, 0),
              ],
              [
                "Bưu điện đang giao",
                pending.reduce((t, p) => t + p.postNotDelivered, 0),
              ],
              [
                "COD đã thu hộ chưa về sổ",
                pending.reduce((t, p) => t + p.codCollected, 0),
              ],
              [
                "Tiền sàn chưa rút",
                pending.reduce((t, p) => t + p.platformNet, 0),
              ],
              ["MPOS chờ về", pending.reduce((t, p) => t + p.pendingCards, 0)],
              [
                "Đơn lỗi kiểm tra",
                pending.reduce((t, p) => t + p.orderIssues, 0),
              ],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-baseline justify-between text-sm"
              >
                <span>{label as string}</span>
                <span className="font-medium">
                  {formatVnd(value as number)}
                </span>
              </div>
            ))}
            <Link
              to="/finance/channels"
              className="block pt-1 text-xs text-primary hover:underline"
            >
              Xem theo chi nhánh
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nhân viên</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.map((s) => (
              <div
                key={s.staff}
                className="flex items-baseline justify-between text-sm"
              >
                <span className="font-medium">{s.staff}</span>
                <span className="text-muted-foreground">
                  {s.orders} đơn ·{" "}
                  <span className="font-medium text-foreground">
                    {formatCompact(s.revenue)}
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Cần xử lý (
              {alerts.length})
            </CardTitle>
            <Link
              to="/ops/alerts"
              className="text-xs text-primary hover:underline"
            >
              Xem tất cả
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có cảnh báo</p>
            ) : null}
            {alerts.slice(0, 5).map((a) => (
              <div key={a.key} className="text-sm">
                <div
                  className={
                    a.level === "error"
                      ? "font-medium text-destructive"
                      : "font-medium text-amber-600"
                  }
                >
                  {a.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(a.date)} · {a.branch} {a.line} · {a.detail}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
