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

import { formatVnd } from "../../components/format";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useScopedData } from "../../components/useScopedData";
import {
  branchUnits,
  financialStatement,
  type StatementRow,
} from "../../model/reports";

type Line = {
  label: string;
  value: (r: StatementRow) => number;
  strong?: boolean;
  muted?: boolean;
  note?: string;
};

const LINES: Line[] = [
  { label: "Doanh thu", value: (r) => r.revenue, strong: true },
  { label: "Số đơn tính doanh thu", value: (r) => r.orders, muted: true },
  {
    label: "Giá vốn hàng bán",
    value: (r) => r.costOfGoods,
    note: "theo Danh mục sản phẩm",
  },
  { label: "Lợi nhuận gộp", value: (r) => r.grossProfit, strong: true },
  { label: "Chi phí vận hành", value: (r) => r.expenses },
  {
    label: "Lợi nhuận sau chi phí vận hành",
    value: (r) => r.operatingResult,
    strong: true,
  },
  { label: "Đã trả nhà cung cấp trong kỳ", value: (r) => r.supplierPayments },
  {
    label: "Còn nợ nhà cung cấp",
    value: (r) => r.debtBalance,
    note: "tab đề xuất",
  },
  { label: "Tồn tiền mặt cuối kỳ", value: (r) => r.cash },
  { label: "Tồn ngân hàng cuối kỳ", value: (r) => r.bank },
  { label: "MPOS chờ về", value: (r) => r.pendingCard, muted: true },
  { label: "Tổng tồn quỹ", value: (r) => r.cash + r.bank, strong: true },
];

export const StatementPage = () => {
  const { scoped } = useScopedData();
  const rows = useMemo(
    () => (scoped ? financialStatement(scoped, branchUnits(scoped)) : []),
    [scoped],
  );
  const fmt = (line: Line, v: number) =>
    line.label.startsWith("Số đơn") ? v.toLocaleString("vi-VN") : formatVnd(v);

  return (
    <div className="space-y-4">
      <SourceNote>
        Báo cáo gộp cho kỳ đang chọn (mặc định tháng này). Doanh thu và chi phí
        cộng trong kỳ; công nợ và tồn quỹ là số tại thời điểm cuối kỳ. Chọn kỳ
        khác ở thanh lọc phía trên để xem tháng trước.
      </SourceNote>
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo tài chính gộp theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chỉ tiêu</TableHead>
                {rows.map((r) => (
                  <TableHead key={r.unit.key} className="text-right">
                    <UnitLabel unit={r.unit} />
                  </TableHead>
                ))}
                <TableHead className="text-right">Toàn hệ thống</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINES.map((line) => (
                <TableRow key={line.label}>
                  <TableCell
                    className={
                      line.strong
                        ? "font-semibold"
                        : line.muted
                          ? "text-muted-foreground"
                          : ""
                    }
                  >
                    {line.label}
                    {line.note ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {line.note}
                      </span>
                    ) : null}
                  </TableCell>
                  {rows.map((r) => (
                    <TableCell
                      key={r.unit.key}
                      className={`text-right ${line.strong ? "font-semibold" : line.muted ? "text-muted-foreground" : ""}`}
                    >
                      {fmt(line, line.value(r))}
                    </TableCell>
                  ))}
                  <TableCell
                    className={`text-right ${line.strong ? "font-semibold" : line.muted ? "text-muted-foreground" : ""}`}
                  >
                    {fmt(
                      line,
                      rows.reduce((t, r) => t + line.value(r), 0),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={rows.length + 2}
                  className="text-xs font-normal text-muted-foreground"
                >
                  Giá vốn = số lượng bán × giá vốn trong Danh mục sản phẩm. Đơn
                  sàn và tên chưa quy chuẩn chưa có giá vốn (xem tỷ lệ khớp ở
                  Hàng hóa › Danh mục sản phẩm).
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
