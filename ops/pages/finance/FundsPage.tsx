import { ResponsiveBar } from "@nivo/bar";
import { useMemo } from "react";

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

import { formatCompact, formatDate, formatVnd } from "../../components/format";
import { Kpi } from "../../components/Kpi";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useScopedData } from "../../components/useScopedData";
import {
  branchUnits,
  fundLatestByUnit,
  fundSeries,
  unitKey,
} from "../../model/reports";

export const FundsPage = () => {
  const { scoped } = useScopedData();
  const view = useMemo(() => {
    if (!scoped) return null;
    const units = branchUnits(scoped);
    return {
      series: fundSeries(scoped.cashbook),
      latest: fundLatestByUnit(scoped.cashbook, units),
      summaries: scoped.fundSummaries,
      units,
    };
  }, [scoped]);
  if (!view) return null;
  const last = view.series.at(-1);
  const first = view.series[0];
  const totals = view.latest.reduce(
    (t, r) => ({
      cash: t.cash + r.cashBalance,
      bank: t.bank + r.bankBalance,
      pending: t.pending + r.pendingCardBalance,
    }),
    { cash: 0, bank: 0, pending: 0 },
  );
  const chart = view.series
    .filter(
      (_, i, all) =>
        all.length <= 40 ||
        i % Math.ceil(all.length / 40) === 0 ||
        i === all.length - 1,
    )
    .map((p) => ({ ...p, label: formatDate(p.date).slice(0, 5) }));

  return (
    <div className="space-y-4">
      <SourceNote>
        Tồn quỹ lấy từ tab Sổ quỹ của từng file: số dư cuối mỗi ngày (cột Tồn
        tiền mặt, Tồn BIDV/MB). Ngân hàng chưa gồm MPOS đang chờ về. "Số dư thực
        tế" là ô kế toán nhập ở đầu tab Sổ quỹ khi chốt.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Tồn tiền mặt"
          value={formatCompact(totals.cash)}
          hint={formatVnd(totals.cash)}
          tone={totals.cash < 0 ? "warning" : "default"}
        />
        <Kpi
          label="Tồn ngân hàng"
          value={formatCompact(totals.bank)}
          hint={formatVnd(totals.bank)}
        />
        <Kpi
          label="MPOS chờ về"
          value={formatCompact(totals.pending)}
          hint="Chưa cộng vào ngân hàng"
        />
        <Kpi
          label="Thay đổi trong kỳ"
          value={last && first ? formatCompact(last.total - first.total) : "–"}
          hint={
            last && first
              ? `${formatDate(first.date)} → ${formatDate(last.date)}`
              : ""
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tồn quỹ theo thời gian (tiền mặt + ngân hàng)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveBar
              data={chart}
              indexBy="label"
              keys={["cash", "bank"]}
              colors={["#16a34a", "#2563eb"]}
              margin={{ top: 10, right: 10, bottom: 30, left: 56 }}
              padding={0.3}
              enableLabel={false}
              axisLeft={{
                format: (v) => formatCompact(Number(v)),
                tickSize: 0,
              }}
              axisBottom={{
                tickSize: 0,
                tickRotation: chart.length > 16 ? -45 : 0,
              }}
              gridYValues={5}
              tooltip={({ id, value, indexValue }) => (
                <div className="rounded bg-popover px-2 py-1 text-xs shadow ring-1 ring-foreground/10">
                  {indexValue} · {id === "cash" ? "Tiền mặt" : "Ngân hàng"}:{" "}
                  <strong>{formatVnd(Number(value))}</strong>
                </div>
              )}
              theme={{
                text: { fill: "var(--muted-foreground)", fontSize: 11 },
              }}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tồn quỹ hiện tại từng chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Ngày sổ</TableHead>
                <TableHead className="text-right">Tiền mặt</TableHead>
                <TableHead className="text-right">Ngân hàng</TableHead>
                <TableHead className="text-right">MPOS chờ về</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Thực tế (tiền mặt)</TableHead>
                <TableHead className="text-right">Lệch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.latest.map((r) => {
                const summary = view.summaries.find(
                  (s) => unitKey(s) === r.unit.key && s.fund === "cash",
                );
                const diff =
                  summary?.actual != null
                    ? r.cashBalance - summary.actual
                    : null;
                return (
                  <TableRow key={r.unit.key}>
                    <TableCell>
                      <UnitLabel unit={r.unit} />
                    </TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell
                      className={
                        r.cashBalance < 0
                          ? "text-right text-destructive"
                          : "text-right"
                      }
                    >
                      {formatVnd(r.cashBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(r.bankBalance)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatVnd(r.pendingCardBalance)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatVnd(r.cashBalance + r.bankBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary?.actual != null ? (
                        formatVnd(summary.actual)
                      ) : (
                        <span className="text-muted-foreground">chưa chốt</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        diff
                          ? "text-right font-medium text-destructive"
                          : "text-right text-muted-foreground"
                      }
                    >
                      {diff == null ? "–" : diff ? formatVnd(diff) : "0 ₫"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {formatVnd(totals.cash)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.bank)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.pending)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(totals.cash + totals.bank)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
