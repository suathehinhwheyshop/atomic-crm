import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
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
import { UnitLabel, unitLabel } from "../../components/UnitLabel";
import { useScopedData } from "../../components/useScopedData";
import { branchUnits, debtSummary, unitKey } from "../../model/reports";

export const DebtsPage = () => {
  const { loaded, scoped } = useScopedData();
  const view = useMemo(() => {
    if (!scoped || !loaded) return null;
    const units = branchUnits(scoped);
    return {
      units,
      summary: debtSummary(scoped.supplierDebts, units, loaded.today),
      debts: [...scoped.supplierDebts].sort((a, b) => b.balance - a.balance),
      today: loaded.today,
    };
  }, [scoped, loaded]);
  if (!view) return null;
  const total = view.summary.reduce(
    (t, s) => ({
      balance: t.balance + s.balance,
      overdue: t.overdue + s.overdue,
      purchased: t.purchased + s.purchased,
      paid: t.paid + s.paid,
    }),
    { balance: 0, overdue: 0, purchased: 0, paid: 0 },
  );

  return (
    <div className="space-y-4">
      <SourceNote proposed>
        Đề xuất thêm vào mỗi file tab <strong>Công nợ NCC</strong> với các cột:
        Ngày | Nhà cung cấp | Nợ đầu kỳ | Nhập trong kỳ | Đã trả | Còn nợ | Hạn
        thanh toán | Ghi chú (1 dòng mỗi nhà cung cấp). Tiền đã trả NCC hiện có
        thể đối chiếu với nhóm CÔNG NỢ NCC ở Bảng Chi phí.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Tổng còn nợ NCC"
          value={formatCompact(total.balance)}
          hint={formatVnd(total.balance)}
        />
        <Kpi
          label="Quá hạn"
          value={formatCompact(total.overdue)}
          hint={formatVnd(total.overdue)}
          tone={total.overdue ? "warning" : "default"}
        />
        <Kpi label="Nhập trong kỳ" value={formatCompact(total.purchased)} />
        <Kpi label="Đã trả trong kỳ" value={formatCompact(total.paid)} />
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
                <TableHead className="text-right">Nhập trong kỳ</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead className="text-right">Quá hạn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.summary.map((s) => (
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
                  {formatVnd(view.summary.reduce((t, s) => t + s.opening, 0))}
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
          <CardTitle>Chi tiết theo nhà cung cấp</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Hạn thanh toán</TableHead>
                <TableHead>Tình trạng</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.debts.map((d) => {
                const overdue =
                  d.balance > 0 && d.dueDate && d.dueDate < view.today;
                const unit = view.units.find((u) => u.key === unitKey(d));
                return (
                  <TableRow key={d.key}>
                    <TableCell className="whitespace-nowrap">
                      {unit ? unitLabel(unit) : d.branch}
                    </TableCell>
                    <TableCell className="font-medium">{d.supplier}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(d.balance)}
                    </TableCell>
                    <TableCell>{formatDate(d.dueDate) || "–"}</TableCell>
                    <TableCell>
                      {d.balance <= 0 ? (
                        <Badge variant="secondary">Đã trả hết</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Quá hạn</Badge>
                      ) : (
                        <Badge variant="outline">Trong hạn</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.note}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
