import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatVnd } from "../../components/format";
import { Kpi } from "../../components/Kpi";
import { SourceNote } from "../../components/SourceNote";
import { useScopedData } from "../../components/useScopedData";
import { unmatchedNames } from "../../model/catalog";

export const CatalogPage = () => {
  const { loaded, scoped } = useScopedData();
  const [search, setSearch] = useState("");
  const view = useMemo(() => {
    if (!loaded || !scoped) return null;
    const items = scoped.orders
      .flatMap((o) => o.items)
      .filter((i) => i.product && i.unitPrice > 0);
    const matched = items
      .filter((i) => i.productCode)
      .reduce((t, i) => t + i.quantity, 0);
    const total = items.reduce((t, i) => t + i.quantity, 0);
    return {
      catalog: loaded.dataset.catalog,
      unmatched: unmatchedNames(scoped.orders),
      matched,
      total,
    };
  }, [loaded, scoped]);
  if (!view) return null;
  const q = search.toLowerCase();
  const catalog = view.catalog.filter(
    (p) =>
      !q ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-4">
      <SourceNote proposed>
        Đề xuất 1 tab <strong>Danh mục sản phẩm</strong> dùng chung cho mọi chi
        nhánh: Ngày | Mã SP | Tên chuẩn | Thương hiệu | Nhóm | Quy cách | Đơn vị
        | Giá vốn | Tên khác (các cách gọi khác, cách nhau bằng dấu ";"). App tự
        khớp tên nhân viên gõ ở các tab bán hàng về tên chuẩn; tên nào chưa khớp
        hiện ở bảng "Chưa quy chuẩn" để bổ sung vào cột Tên khác. Có Giá vốn thì
        tính được lợi nhuận gộp.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Sản phẩm trong danh mục"
          value={String(view.catalog.length)}
        />
        <Kpi
          label="Tên gọi khác đã khai"
          value={String(view.catalog.reduce((t, p) => t + p.aliases.length, 0))}
        />
        <Kpi
          label="Sản phẩm bán ra đã khớp"
          value={
            view.total
              ? `${Math.round((view.matched / view.total) * 100)}%`
              : "–"
          }
          hint={`${view.matched.toLocaleString("vi-VN")} / ${view.total.toLocaleString("vi-VN")} đơn vị trong kỳ`}
        />
        <Kpi
          label="Tên chưa quy chuẩn"
          value={String(view.unmatched.length)}
          tone={view.unmatched.length ? "warning" : "default"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Chưa quy chuẩn – cần thêm vào cột Tên khác ({view.unmatched.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {view.unmatched.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              Mọi tên sản phẩm trong kỳ đều khớp danh mục.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên nhân viên gõ</TableHead>
                  <TableHead className="text-right">Số lượng bán</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead>Đơn ví dụ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.unmatched.map((u) => (
                  <TableRow key={u.name}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-right">
                      {u.quantity.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>{u.branches.join(", ")}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.sample}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Danh mục sản phẩm ({catalog.length})</CardTitle>
          <Input
            placeholder="Tìm mã, tên, tên khác…"
            className="h-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã SP</TableHead>
                <TableHead>Tên chuẩn</TableHead>
                <TableHead>Thương hiệu</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead>Tên khác (khớp tự động)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.map((p) => (
                <TableRow key={p.code}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell>{p.group}</TableCell>
                  <TableCell className="text-right">
                    {p.costPrice ? (
                      formatVnd(p.costPrice)
                    ) : (
                      <span className="text-muted-foreground">
                        [CHƯA CÓ SỐ]
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {p.aliases.map((a) => (
                      <Badge key={a} variant="outline" className="font-normal">
                        {a}
                      </Badge>
                    ))}
                    {p.aliases.length === 0 ? (
                      <span className="text-xs text-muted-foreground">–</span>
                    ) : null}
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
