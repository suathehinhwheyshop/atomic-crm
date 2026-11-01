import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatCompact, formatVnd } from "../../components/format";
import { GranularityToggle } from "../../components/GranularityToggle";
import { Kpi } from "../../components/Kpi";
import { MatrixTable } from "../../components/MatrixTable";
import { SourceNote } from "../../components/SourceNote";
import { useScopedData } from "../../components/useScopedData";
import type { Granularity } from "../../model/period";
import {
  branchUnits,
  costMatrix,
  costOfGoods,
  expenseMatrix,
  matrixTotal,
  orderCountMatrix,
  revenueMatrix,
  type Matrix,
} from "../../model/reports";

const subtract = (a: Matrix, b: Matrix): Matrix => {
  const values = new Map(a.values);
  b.values.forEach((v, k) => values.set(k, (values.get(k) ?? 0) - v));
  const periodKeys = new Set(a.periods.map((p) => p.key));
  return {
    ...a,
    periods: [
      ...a.periods,
      ...b.periods.filter((p) => !periodKeys.has(p.key)),
    ].sort((x, y) => x.start.localeCompare(y.start)),
    values,
  };
};

export const RevenuePage = () => {
  const { scoped } = useScopedData();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const view = useMemo(() => {
    if (!scoped) return null;
    const units = branchUnits(scoped);
    const revenue = revenueMatrix(scoped, units, granularity);
    const expenses = expenseMatrix(scoped, units, granularity);
    const gross = subtract(
      revenue,
      costMatrix(scoped.orders, units, granularity),
    );
    return {
      revenue,
      expenses,
      orders: orderCountMatrix(scoped, units, granularity),
      gross,
      result: subtract(gross, expenses),
      cogs: costOfGoods(scoped.orders),
    };
  }, [scoped, granularity]);
  if (!view) return null;
  const totalRevenue = matrixTotal(view.revenue);
  const totalExpenses = matrixTotal(view.expenses);
  const coverage = Math.round(view.cogs.coverage * 100);

  return (
    <div className="space-y-4">
      <SourceNote>
        Doanh thu tính theo quy tắc của file báo cáo (nội thành chỉ đơn Đã giao,
        Bưu điện theo Loại đơn, sàn chỉ dòng OK). Chi phí vận hành lấy từ Bảng
        Chi phí (dòng OK), không gồm chuyển quỹ nội bộ và trả công nợ NCC. Giá
        vốn lấy theo Danh mục sản phẩm; đơn sàn và tên chưa quy chuẩn chưa có
        giá vốn (hiện khớp {coverage}% số lượng bán ra).
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Doanh thu kỳ"
          value={formatCompact(totalRevenue)}
          hint={formatVnd(totalRevenue)}
        />
        <Kpi
          label="Số đơn"
          value={matrixTotal(view.orders).toLocaleString("vi-VN")}
        />
        <Kpi
          label="Lợi nhuận gộp"
          value={formatCompact(totalRevenue - view.cogs.cost)}
          hint={`Giá vốn ${formatCompact(view.cogs.cost)} · khớp ${coverage}%`}
        />
        <Kpi
          label="Sau chi phí vận hành"
          value={formatCompact(totalRevenue - view.cogs.cost - totalExpenses)}
          hint={`Chi phí ${formatCompact(totalExpenses)}`}
        />
      </div>
      <div className="flex justify-end">
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable matrix={view.revenue} format={formatCompact} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Số đơn theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable
            matrix={view.orders}
            format={(v) => v.toLocaleString("vi-VN")}
            emphasizeTotal={false}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lợi nhuận gộp (Doanh thu − Giá vốn)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable matrix={view.gross} format={formatCompact} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sau chi phí vận hành (Lợi nhuận gộp − Chi phí)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable matrix={view.result} format={formatCompact} />
        </CardContent>
      </Card>
    </div>
  );
};
