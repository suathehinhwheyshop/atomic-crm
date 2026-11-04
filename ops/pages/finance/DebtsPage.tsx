import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { UnitLabel, unitLabel } from "../../components/UnitLabel";
import { useReportScope } from "../../components/useReportScope";
import { useScopedData } from "../../components/useScopedData";
import { scheduleBySupplier } from "../../model/accounting";
import { debtPeriods } from "../../model/finance";
import { branchUnits, debtSummary } from "../../model/reports";
import { KIND_LABELS, type SupplierBalance } from "../../model/supplierLedger";

const money = (v: number) =>
  v ? formatVnd(v) : <span className="text-muted-foreground">–</span>;

const LedgerSheet = ({
  balance,
  onClose,
}: {
  balance: SupplierBalance | null;
  onClose: () => void;
}) => {
  const running = useMemo(() => {
    if (!balance) return [];
    let total = 0;
    return [...balance.entries]
      .reverse()
      .map((e) => {
        total += e.kind === "payment" ? -e.amount : e.amount;
        return { ...e, running: total };
      })
      .reverse();
  }, [balance]);
  return (
    <Sheet
      open={Boolean(balance)}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-4xl">
        {balance ? (
          <>
            <SheetHeader>
              <SheetTitle>{balance.supplier}</SheetTitle>
              <SheetDescription>
                {unitLabel({
                  key: `${balance.branch}-${balance.line}`,
                  branch: balance.branch,
                  line: balance.line,
                })}{" "}
                · còn nợ <strong>{formatVnd(balance.balance)}</strong>
                {balance.nextDue
                  ? ` · hạn gần nhất ${formatDate(balance.nextDue)}`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-x-auto px-4 pb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số phiếu</TableHead>
                    <TableHead>Diễn giải</TableHead>
                    <TableHead className="text-right">Nợ tăng</TableHead>
                    <TableHead className="text-right">Đã trả</TableHead>
                    <TableHead className="text-right">Còn nợ</TableHead>
                    <TableHead>Hạn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {running.map((e) => (
                    <TableRow key={e.key}>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell>{KIND_LABELS[e.kind]}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.ref}
                      </TableCell>
                      <TableCell className="max-w-56">
                        <span className="line-clamp-1" title={e.description}>
                          {e.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {e.kind === "payment" ? "" : formatVnd(e.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.kind === "payment" ? formatVnd(e.amount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVnd(e.running)}
                      </TableCell>
                      <TableCell>{formatDate(e.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export const DebtsPage = () => {
  const { loaded, scoped } = useScopedData();
  const { from, to } = useReportScope();
  const [selected, setSelected] = useState<SupplierBalance | null>(null);
  const summary = useMemo(
    () =>
      scoped && loaded
        ? debtSummary(scoped, branchUnits(scoped), loaded.today)
        : [],
    [scoped, loaded],
  );
  const periods = useMemo(
    () =>
      scoped && loaded
        ? debtPeriods(scoped, branchUnits(scoped), from, to, loaded.today)
        : [],
    [scoped, loaded, from, to],
  );
  const periodTotal = periods.reduce(
    (t, p) => ({
      opening: t.opening + p.opening,
      purchased: t.purchased + p.purchased,
      paid: t.paid + p.paid,
      closing: t.closing + p.closing,
      overdue: t.overdue + p.overdue,
    }),
    { opening: 0, purchased: 0, paid: 0, closing: 0, overdue: 0 },
  );
  const schedule = useMemo(
    () => scheduleBySupplier(scoped?.paymentSchedule ?? []),
    [scoped],
  );
  const infoOf = (b: SupplierBalance) =>
    scoped?.supplierInfo.find(
      (i) =>
        i.supplier === b.supplier && i.branch === b.branch && i.line === b.line,
    );
  const balances = summary
    .flatMap((s) => s.balances)
    .sort((a, b) => b.balance - a.balance);
  const total = summary.reduce(
    (t, s) => ({
      opening: t.opening + s.opening,
      purchased: t.purchased + s.purchased,
      paid: t.paid + s.paid,
      balance: t.balance + s.balance,
      overdue: t.overdue + s.overdue,
    }),
    { opening: 0, purchased: 0, paid: 0, balance: 0, overdue: 0 },
  );
  const notDue = balances.reduce((t, b) => t + b.notDue, 0);
  const overdue90 = balances.reduce((t, b) => t + b.overdue90, 0);

  return (
    <div className="space-y-4">
      <SourceNote>
        Lấy từ tab "Công nợ NCC" của file BCTC từng chi nhánh (mỗi dòng 1 lần
        nhập hàng hoặc 1 lần trả; dòng "Số dư đầu kỳ" là nợ chuyển sang). Khi
        chi nhánh chưa có file BCTC, phần đã trả tạm lấy từ Bảng Chi phí nhóm
        CÔNG NỢ NCC. Lịch thanh toán tuần lấy từ tab "Lịch TT NCC".
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Tổng còn nợ NCC"
          value={formatCompact(total.balance)}
          hint={formatVnd(total.balance)}
        />
        <Kpi label="Chưa đến hạn" value={formatCompact(notDue)} />
        <Kpi
          label="Quá hạn ≤ 30 ngày"
          value={formatCompact(total.overdue - overdue90)}
          tone={total.overdue - overdue90 ? "warning" : "default"}
        />
        <Kpi
          label="Quá hạn > 30 ngày"
          value={formatCompact(overdue90)}
          tone={overdue90 ? "warning" : "default"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Công nợ đầu kỳ – cuối kỳ từng chi nhánh ({formatDate(from)} →{" "}
            {formatDate(to)})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead className="text-right">Số NCC</TableHead>
                <TableHead className="text-right">Nợ đầu kỳ</TableHead>
                <TableHead className="text-right">Nhập trong kỳ</TableHead>
                <TableHead className="text-right">Trả trong kỳ</TableHead>
                <TableHead className="text-right">Nợ cuối kỳ</TableHead>
                <TableHead className="text-right">Trong đó quá hạn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((s) => (
                <TableRow key={s.unit.key}>
                  <TableCell>
                    <UnitLabel unit={s.unit} />
                  </TableCell>
                  <TableCell className="text-right">{s.suppliers}</TableCell>
                  <TableCell className="text-right">
                    {formatVnd(s.opening)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(s.purchased)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(s.paid)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVnd(s.closing)}
                  </TableCell>
                  <TableCell
                    className={
                      s.overdue
                        ? "text-right font-medium text-destructive"
                        : "text-right text-muted-foreground"
                    }
                  >
                    {s.overdue ? formatVnd(s.overdue) : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {formatVnd(periodTotal.opening)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(periodTotal.purchased)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(periodTotal.paid)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(periodTotal.closing)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(periodTotal.overdue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết từng nhà cung cấp (bấm để xem sổ)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead className="text-right">Nhập hàng</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead className="text-right">Chưa đến hạn</TableHead>
                <TableHead className="text-right">Quá hạn ≤30</TableHead>
                <TableHead className="text-right">Quá hạn &gt;30</TableHead>
                <TableHead>Hạn gần nhất</TableHead>
                <TableHead>Tình trạng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow
                  key={`${b.branch}-${b.line}-${b.supplier}`}
                  className="cursor-pointer"
                  onClick={() => setSelected(b)}
                >
                  <TableCell className="whitespace-nowrap">
                    {unitLabel({
                      key: `${b.branch}-${b.line}`,
                      branch: b.branch,
                      line: b.line,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{b.supplier}</div>
                    {infoOf(b) ? (
                      <div className="text-xs text-muted-foreground">
                        {[infoOf(b)?.company, infoOf(b)?.bank]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(b.opening + b.purchased)}
                  </TableCell>
                  <TableCell className="text-right">{money(b.paid)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {money(b.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(b.notDue)}
                  </TableCell>
                  <TableCell
                    className={
                      b.overdue30 ? "text-right text-amber-600" : "text-right"
                    }
                  >
                    {money(b.overdue30)}
                  </TableCell>
                  <TableCell
                    className={
                      b.overdue90
                        ? "text-right font-medium text-destructive"
                        : "text-right"
                    }
                  >
                    {money(b.overdue90)}
                  </TableCell>
                  <TableCell>{formatDate(b.nextDue) || "–"}</TableCell>
                  <TableCell>
                    {b.balance <= 0 ? (
                      <Badge variant="secondary">Đã trả hết</Badge>
                    ) : b.overdue90 ? (
                      <Badge variant="destructive">Quá hạn lâu</Badge>
                    ) : b.overdue30 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-600"
                      >
                        Quá hạn
                      </Badge>
                    ) : (
                      <Badge variant="outline">Trong hạn</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {schedule.length ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Lịch thanh toán NCC (tab "Lịch TT NCC") · còn thiếu{" "}
              {formatCompact(schedule.reduce((t, s) => t + s.remaining, 0))}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead className="text-right">Công nợ</TableHead>
                  <TableHead className="text-right">Đã thanh toán</TableHead>
                  <TableHead className="text-right">Còn thiếu</TableHead>
                  <TableHead>
                    Chi tiết (ngày · chi nhánh · phương thức)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((s) => (
                  <TableRow key={s.supplier}>
                    <TableCell className="font-medium">{s.supplier}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(s.due)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(s.paid)}
                    </TableCell>
                    <TableCell
                      className={
                        s.remaining
                          ? "text-right font-semibold text-amber-600"
                          : "text-right text-muted-foreground"
                      }
                    >
                      {s.remaining ? formatVnd(s.remaining) : "0 ₫"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.rows
                        .map(
                          (r) =>
                            `${formatDate(r.date)} · ${r.note || "–"} · ${formatVnd(r.due)}${r.remaining ? ` (thiếu ${formatVnd(r.remaining)})` : ""}${r.method ? ` · ${r.method}` : ""}`,
                        )
                        .join("; ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      <LedgerSheet balance={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
