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

import { formatCompact, formatVnd } from "../../components/format";
import { MatrixTable } from "../../components/MatrixTable";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useScopedData } from "../../components/useScopedData";
import {
  branchUnits,
  expenseMatrix,
  expensesByGroup,
  matrixTotal,
  supplierPaymentMatrix,
  type BranchKey,
} from "../../model/reports";

export const ExpensesPage = () => {
  const { scoped } = useScopedData();
  const view = useMemo(() => {
    if (!scoped) return null;
    const units = branchUnits(scoped);
    return {
      units,
      monthly: expenseMatrix(scoped, units, "month"),
      groups: expensesByGroup(scoped),
      supplier: supplierPaymentMatrix(scoped, units, "month"),
    };
  }, [scoped]);
  if (!view) return null;
  const perUnitTotal = (key: BranchKey) =>
    view.groups.reduce((t, g) => t + (g.perUnit.get(key) ?? 0), 0);
  const grand = view.groups.reduce((t, g) => t + g.total, 0);

  return (
    <div className="space-y-4">
      <SourceNote>
        Chi phí vận hành = các dòng Loại "Chi", Kiểm tra OK trong Bảng Chi phí,
        trừ nhóm NỘP - CHUYỂN QUỸ (chuyển tiền nội bộ) và CÔNG NỢ NCC (trả tiền
        hàng, xem bảng riêng bên dưới).
      </SourceNote>
      <Card>
        <CardHeader>
          <CardTitle>Chi phí vận hành theo tháng từng chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable
            matrix={view.monthly}
            format={formatCompact}
            firstColumn="Tháng"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chi phí theo nhóm trong kỳ</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm chi phí</TableHead>
                {view.units.map((u) => (
                  <TableHead key={u.key} className="text-right">
                    <UnitLabel unit={u} />
                  </TableHead>
                ))}
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Tỷ trọng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.groups.map((g) => (
                <TableRow key={g.group}>
                  <TableCell className="font-medium">{g.group}</TableCell>
                  {view.units.map((u) => {
                    const v = g.perUnit.get(u.key) ?? 0;
                    return (
                      <TableCell
                        key={u.key}
                        className={
                          v ? "text-right" : "text-right text-muted-foreground"
                        }
                      >
                        {v ? formatVnd(v) : "–"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">
                    {formatVnd(g.total)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {grand ? `${Math.round((g.total / grand) * 100)}%` : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                {view.units.map((u) => (
                  <TableCell key={u.key} className="text-right">
                    {formatVnd(perUnitTotal(u.key))}
                  </TableCell>
                ))}
                <TableCell className="text-right">{formatVnd(grand)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Tiền đã trả nhà cung cấp theo tháng (nhóm CÔNG NỢ NCC)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {matrixTotal(view.supplier) ? (
            <MatrixTable
              matrix={view.supplier}
              format={formatCompact}
              firstColumn="Tháng"
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Chưa có dòng trả NCC trong kỳ.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
