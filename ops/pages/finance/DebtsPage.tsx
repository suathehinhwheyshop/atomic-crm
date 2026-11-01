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
import { useScopedData } from "../../components/useScopedData";
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
  const [selected, setSelected] = useState<SupplierBalance | null>(null);
  const summary = useMemo(
    () =>
      scoped && loaded
        ? debtSummary(scoped, branchUnits(scoped), loaded.today)
        : [],
    [scoped, loaded],
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
      <SourceNote proposed>
        Đề xuất tab <strong>Công nợ NCC</strong> ghi từng phát sinh, 1 dòng 1
        việc: Ngày | Nhà cung cấp | Loại (Nợ đầu kỳ / Nhập hàng / Trả tiền) | Số
        phiếu | Diễn giải | Số tiền | Hạn thanh toán | Ghi chú. App tự tính còn
        nợ, trừ tiền trả vào khoản cũ nhất trước, và báo quá hạn theo hạn của
        từng lần nhập. Dòng "Trả tiền" đối chiếu được với nhóm CÔNG NỢ NCC ở
        Bảng Chi phí.
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
          <CardTitle>Tóm tắt công nợ từng chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead className="text-right">Số NCC</TableHead>
                <TableHead className="text-right">Nợ đầu kỳ</TableHead>
                <TableHead className="text-right">Nhập hàng</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead className="text-right">Quá hạn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
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
                    {formatVnd(s.balance)}
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
                  {formatVnd(total.opening)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(total.purchased)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(total.paid)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(total.balance)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(total.overdue)}
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
                  <TableCell className="font-medium">{b.supplier}</TableCell>
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
      <LedgerSheet balance={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
