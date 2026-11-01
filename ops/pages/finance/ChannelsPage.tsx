import { useMemo, useState } from "react";

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

import { formatCompact, formatVnd } from "../../components/format";
import { GranularityToggle } from "../../components/GranularityToggle";
import { Kpi } from "../../components/Kpi";
import { MatrixTable } from "../../components/MatrixTable";
import { Segmented } from "../../components/Segmented";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useReportScope } from "../../components/useReportScope";
import {
  CHANNEL_ORDER,
  channelsByUnit,
  pendingMoney,
} from "../../model/finance";
import { summarizeChannels } from "../../model/metrics";
import { CHANNEL_LABELS } from "../../model/parseWorkbook";
import type { Granularity } from "../../model/period";
import { revenueMatrix } from "../../model/reports";
import type { Channel, Dataset } from "../../model/types";

const onlyChannel = (data: Dataset, channel: Channel): Dataset => ({
  ...data,
  orders: data.orders.filter((o) => o.channel === channel),
  platformOrders: data.platformOrders.filter((o) => o.channel === channel),
});

export const ChannelsPage = () => {
  const { scoped, units } = useReportScope();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [channel, setChannel] = useState<Channel>("store");
  const view = useMemo(() => {
    if (!scoped) return null;
    return {
      summary: summarizeChannels(scoped),
      byUnit: channelsByUnit(scoped, units),
      matrix: revenueMatrix(onlyChannel(scoped, channel), units, granularity),
      pending: pendingMoney(scoped, units),
    };
  }, [scoped, units, channel, granularity]);
  if (!view) return null;
  const grand = view.summary.reduce((t, c) => t + c.revenue, 0);
  const pendingTotal = view.pending.reduce(
    (t, p) =>
      t +
      p.localUnpaid +
      p.postNotDelivered +
      p.codCollected +
      p.platformNet +
      p.pendingCards,
    0,
  );

  return (
    <div className="space-y-4">
      <SourceNote>
        Doanh thu theo kênh như file báo cáo: cửa hàng = đơn OK; nội thành = đơn
        Đã giao; bưu điện = Đã giao (Mới tính đủ, Gửi lại chỉ phí ship); sàn =
        dòng Hệ thống OK (tiền thực nhận sau phí sàn ở cột chuyển khoản).
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {view.summary.map((c) => (
          <Kpi
            key={c.channel}
            label={CHANNEL_LABELS[c.channel]}
            value={formatCompact(c.revenue)}
            hint={`${c.orders} đơn · ${grand ? Math.round((c.revenue / grand) * 100) : 0}%`}
          />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo kênh từng chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                {CHANNEL_ORDER.map((c) => (
                  <TableHead key={c} className="text-right">
                    {CHANNEL_LABELS[c]}
                  </TableHead>
                ))}
                <TableHead className="text-right">Tổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.byUnit.map((row) => (
                <TableRow key={row.unit.key}>
                  <TableCell>
                    <UnitLabel unit={row.unit} />
                  </TableCell>
                  {CHANNEL_ORDER.map((c) => {
                    const v =
                      row.channels.find((x) => x.channel === c)?.revenue ?? 0;
                    return (
                      <TableCell
                        key={c}
                        className={
                          v ? "text-right" : "text-right text-muted-foreground"
                        }
                      >
                        {v ? formatVnd(v) : "–"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">
                    {formatVnd(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                {CHANNEL_ORDER.map((c) => (
                  <TableCell key={c} className="text-right">
                    {formatVnd(
                      view.summary.find((x) => x.channel === c)?.revenue ?? 0,
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right">{formatVnd(grand)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Hình thức thanh toán theo kênh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kênh</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Tiền mặt</TableHead>
                <TableHead className="text-right">Chuyển khoản</TableHead>
                <TableHead className="text-right">Quẹt thẻ</TableHead>
                <TableHead className="text-right">COD (BĐ thu hộ)</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.summary.map((c) => (
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
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Diễn biến một kênh theo chi nhánh</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Segmented<Channel>
              label="Kênh"
              value={channel}
              onChange={setChannel}
              options={CHANNEL_ORDER.map((c) => ({
                value: c,
                label: CHANNEL_LABELS[c],
              }))}
            />
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable matrix={view.matrix} format={formatCompact} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Tiền chưa vào Sổ quỹ ({formatCompact(pendingTotal)})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead className="text-right">
                  Nội thành đã giao chưa thu
                </TableHead>
                <TableHead className="text-right">Bưu điện đang giao</TableHead>
                <TableHead className="text-right">
                  COD đã thu hộ chưa về sổ
                </TableHead>
                <TableHead className="text-right">Tiền sàn chưa rút</TableHead>
                <TableHead className="text-right">MPOS chờ về</TableHead>
                <TableHead className="text-right">Đơn lỗi kiểm tra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.pending.map((p) => (
                <TableRow key={p.unit.key}>
                  <TableCell>
                    <UnitLabel unit={p.unit} />
                  </TableCell>
                  {[
                    p.localUnpaid,
                    p.postNotDelivered,
                    p.codCollected,
                    p.platformNet,
                    p.pendingCards,
                  ].map((v, i) => (
                    <TableCell
                      key={i}
                      className={
                        v ? "text-right" : "text-right text-muted-foreground"
                      }
                    >
                      {v ? formatVnd(v) : "–"}
                    </TableCell>
                  ))}
                  <TableCell
                    className={
                      p.orderIssues
                        ? "text-right font-medium text-destructive"
                        : "text-right text-muted-foreground"
                    }
                  >
                    {p.orderIssues ? formatVnd(p.orderIssues) : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-6 pt-2 text-xs text-muted-foreground">
            COD và tiền sàn: so tiền đã thu/thực nhận với dòng "Thu khác" nhóm
            ĐƠN TỈNH - BƯU ĐIỆN / DOANH THU SÀN đã ghi ở Bảng Chi phí trong kỳ.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
