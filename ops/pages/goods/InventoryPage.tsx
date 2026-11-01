import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { branchUnits, inventorySummary, unitKey } from "../../model/reports";

const qty = (v: number) => v.toLocaleString("vi-VN");

export const InventoryPage = () => {
  const { scoped } = useScopedData();
  const [search, setSearch] = useState("");
  const view = useMemo(() => {
    if (!scoped) return null;
    const units = branchUnits(scoped);
    return {
      units,
      summary: inventorySummary(scoped.inventory, units),
      items: scoped.inventory,
    };
  }, [scoped]);
  if (!view) return null;
  const total = view.summary.reduce(
    (t, s) => ({
      quantity: t.quantity + s.quantity,
      value: t.value + s.value,
      low: t.low + s.belowMinimum,
    }),
    { quantity: 0, value: 0, low: 0 },
  );
  const items = view.items
    .filter((i) => i.product.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        (a.minimum > 0 && a.quantity <= a.minimum ? 0 : 1) -
          (b.minimum > 0 && b.quantity <= b.minimum ? 0 : 1) ||
        a.product.localeCompare(b.product),
    );

  return (
    <div className="space-y-4">
      <SourceNote proposed>
        Đề xuất thêm vào mỗi file tab <strong>Tồn kho</strong> với các cột: Ngày
        | Sản phẩm | Tồn | Đơn vị | Giá vốn | Tồn tối thiểu (1 dòng mỗi sản
        phẩm, cập nhật khi kiểm kho). Vinh và Đà Nẵng gộp 1 bảng.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tổng tồn (hộp)" value={qty(total.quantity)} />
        <Kpi
          label="Giá trị tồn theo giá vốn"
          value={formatCompact(total.value)}
          hint={formatVnd(total.value)}
        />
        <Kpi
          label="Sản phẩm dưới mức tối thiểu"
          value={qty(total.low)}
          tone={total.low ? "warning" : "default"}
        />
        <Kpi label="Chi nhánh có số" value={String(view.summary.length)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tồn kho hiện tại theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead className="text-right">Số mặt hàng</TableHead>
                <TableHead className="text-right">Tổng tồn</TableHead>
                <TableHead className="text-right">Giá trị (giá vốn)</TableHead>
                <TableHead className="text-right">Dưới tối thiểu</TableHead>
                <TableHead>Kiểm kho gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.summary.map((s) => (
                <TableRow key={s.unit.key}>
                  <TableCell>
                    <UnitLabel unit={s.unit} />
                  </TableCell>
                  <TableCell className="text-right">{s.products}</TableCell>
                  <TableCell className="text-right font-medium">
                    {qty(s.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(s.value)}
                  </TableCell>
                  <TableCell
                    className={
                      s.belowMinimum
                        ? "text-right font-medium text-amber-600"
                        : "text-right text-muted-foreground"
                    }
                  >
                    {s.belowMinimum || "–"}
                  </TableCell>
                  <TableCell>{formatDate(s.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Tổng</TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {qty(total.quantity)}
                </TableCell>
                <TableCell className="text-right">
                  {formatVnd(total.value)}
                </TableCell>
                <TableCell className="text-right">{total.low}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Chi tiết tồn từng sản phẩm</CardTitle>
          <Input
            placeholder="Tìm sản phẩm…"
            className="h-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
                <TableHead className="text-right">Tối thiểu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Giá trị</TableHead>
                <TableHead>Tình trạng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const low = i.minimum > 0 && i.quantity <= i.minimum;
                const unit = view.units.find((u) => u.key === unitKey(i));
                return (
                  <TableRow key={i.key}>
                    <TableCell className="whitespace-nowrap">
                      {unit ? unitLabel(unit) : i.branch}
                    </TableCell>
                    <TableCell>{i.product}</TableCell>
                    <TableCell className="text-right font-medium">
                      {qty(i.quantity)} {i.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {i.minimum || "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(i.costPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(i.quantity * i.costPrice)}
                    </TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive">Cần nhập</Badge>
                      ) : (
                        <Badge variant="secondary">Đủ</Badge>
                      )}
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
