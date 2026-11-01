import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCompact, formatDate, formatVnd } from "../components/format";
import { Segmented } from "../components/Segmented";
import { useScopedData } from "../components/useScopedData";
import { shiftSummary, staffTotals } from "../model/metrics";
import { CHANNEL_LABELS } from "../model/parseWorkbook";

export const ShiftsPage = () => {
  const { scoped } = useScopedData();
  const [staff, setStaff] = useState("ALL");
  const rows = useMemo(() => shiftSummary(scoped?.orders ?? []), [scoped]);
  const totals = useMemo(() => staffTotals(rows), [rows]);
  const visible = rows.filter((r) => staff === "ALL" || r.staff === staff);
  const maxRevenue = Math.max(1, ...totals.map((t) => t.revenue));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo nhân viên</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totals.map((t) => (
            <div
              key={t.staff}
              className="grid grid-cols-[8rem_1fr_8rem] items-center gap-3 text-sm"
            >
              <span className="font-medium">{t.staff}</span>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded bg-primary"
                  style={{ width: `${(t.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-right text-muted-foreground">
                {t.orders} đơn ·{" "}
                <span className="font-medium text-foreground">
                  {formatCompact(t.revenue)}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Nhân viên:</span>
        <Segmented
          label="Nhân viên"
          value={staff}
          onChange={setStaff}
          options={[
            { value: "ALL", label: "Tất cả" },
            ...totals.map((t) => ({ value: t.staff, label: t.staff })),
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tổng hợp theo ca</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Kênh</TableHead>
                <TableHead>Ca</TableHead>
                <TableHead>Nhân viên</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Tiền mặt</TableHead>
                <TableHead className="text-right">Chuyển khoản</TableHead>
                <TableHead className="text-right">Quẹt thẻ</TableHead>
                <TableHead className="text-right">COD</TableHead>
                <TableHead>Kiểm tra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.slice(0, 300).map((r) => (
                <TableRow key={`${r.date}-${r.staff}-${r.channel}`}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell>{CHANNEL_LABELS[r.channel]}</TableCell>
                  <TableCell>{r.shift}</TableCell>
                  <TableCell className="font-medium">{r.staff}</TableCell>
                  <TableCell className="text-right">{r.orders}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatVnd(r.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(r.cash)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(r.bank)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(r.card)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(r.cod)}
                  </TableCell>
                  <TableCell
                    className={
                      r.issues
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {r.issues ? `${r.issues} đơn lỗi` : "OK"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
