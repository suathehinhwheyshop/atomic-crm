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
import { useReportScope } from "../../components/useReportScope";
import { fundPeriods, type FundPeriod } from "../../model/finance";
import { fundSeries } from "../../model/reports";

const FUND_LABEL = { cash: "Tiền mặt", bank: "Ngân hàng" };

const totals = (rows: FundPeriod[]) =>
  rows.reduce(
    (t, r) => ({
      opening: t.opening + r.opening,
      inflow: t.inflow + r.inflow,
      outflow: t.outflow + r.outflow,
      closing: t.closing + r.closing,
    }),
    { opening: 0, inflow: 0, outflow: 0, closing: 0 },
  );

export const FundsPage = () => {
  const { scoped, units, from, to } = useReportScope();
  const view = useMemo(() => {
    if (!scoped) return null;
    const periods = fundPeriods(scoped, units, from, to);
    return {
      periods,
      series: fundSeries(scoped.cashbook.filter((r) => r.date >= from)),
      pending: scoped.pendingCards.reduce((t, p) => t + p.amount, 0),
    };
  }, [scoped, units, from, to]);
  if (!view) return null;
  const all = totals(view.periods);
  const cash = totals(view.periods.filter((p) => p.fund === "cash"));
  const bank = totals(view.periods.filter((p) => p.fund === "bank"));
  const chart = view.series
    .filter(
      (_, i, list) =>
        list.length <= 40 ||
        i % Math.ceil(list.length / 40) === 0 ||
        i === list.length - 1,
    )
    .map((p) => ({ ...p, label: formatDate(p.date).slice(0, 5) }));

  return (
    <div className="space-y-4">
      <SourceNote>
        Lấy từ tab Sổ quỹ của từng file: số dư đầu kỳ là tồn cuối ngày trước kỳ,
        thu/chi cộng trong kỳ, số dư cuối kỳ là tồn ngày cuối. Ngân hàng chưa
        gồm MPOS đang chờ về. "Thực tế" là số kế toán nhập ở đầu tab Sổ quỹ khi
        chốt, chỉ hiện khi ngày chốt trùng ngày cuối kỳ.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label="Đầu kỳ"
          value={formatCompact(all.opening)}
          hint={formatDate(from)}
        />
        <Kpi label="Tổng thu trong kỳ" value={formatCompact(all.inflow)} />
        <Kpi label="Tổng chi trong kỳ" value={formatCompact(all.outflow)} />
        <Kpi
          label="Cuối kỳ"
          value={formatCompact(all.closing)}
          hint={`Tiền mặt ${formatCompact(cash.closing)} · NH ${formatCompact(bank.closing)}`}
        />
        <Kpi
          label="MPOS chờ về"
          value={formatCompact(view.pending)}
          hint="Chưa cộng vào ngân hàng"
          tone={view.pending ? "warning" : "default"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sổ quỹ tóm tắt theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Quỹ</TableHead>
                <TableHead className="text-right">Đầu kỳ</TableHead>
                <TableHead className="text-right">Thu</TableHead>
                <TableHead className="text-right">Chi</TableHead>
                <TableHead className="text-right">Cuối kỳ</TableHead>
                <TableHead>Ngày sổ</TableHead>
                <TableHead className="text-right">Thực tế</TableHead>
                <TableHead className="text-right">Lệch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.periods.map((p) => {
                const diff = p.actual != null ? p.closing - p.actual : null;
                return (
                  <TableRow key={`${p.unit.key}-${p.fund}`}>
                    <TableCell>
                      {p.fund === "cash" ? <UnitLabel unit={p.unit} /> : null}
                    </TableCell>
                    <TableCell>{FUND_LABEL[p.fund]}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(p.opening)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(p.inflow)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(p.outflow)}
                    </TableCell>
                    <TableCell
                      className={
                        p.closing < 0
                          ? "text-right font-semibold text-destructive"
                          : "text-right font-semibold"
                      }
                    >
                      {formatVnd(p.closing)}
                    </TableCell>
                    <TableCell>{formatDate(p.closingDate)}</TableCell>
                    <TableCell className="text-right">
                      {p.actual != null ? (
                        formatVnd(p.actual)
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
                      {diff == null ? "–" : formatVnd(diff)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              {[
                ["Tiền mặt", cash],
                ["Ngân hàng", bank],
                ["Tổng", all],
              ].map(([label, t]) => (
                <TableRow key={label as string}>
                  <TableCell>{label as string}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatVnd((t as typeof all).opening)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd((t as typeof all).inflow)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd((t as typeof all).outflow)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd((t as typeof all).closing)}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Tồn quỹ theo ngày trong kỳ (tiền mặt + ngân hàng)
          </CardTitle>
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
    </div>
  );
};
