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

import { GranularityToggle } from "../../components/GranularityToggle";
import { MatrixTable } from "../../components/MatrixTable";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useScopedData } from "../../components/useScopedData";
import type { Granularity } from "../../model/period";
import { branchUnits, productVolume, volumeMatrix } from "../../model/reports";

const qty = (v: number) => v.toLocaleString("vi-VN");

export const VolumePage = () => {
  const { scoped } = useScopedData();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [search, setSearch] = useState("");
  const view = useMemo(() => {
    if (!scoped) return null;
    const units = branchUnits(scoped);
    return {
      units,
      matrix: volumeMatrix(scoped.orders, units, granularity),
      products: productVolume(scoped.orders),
    };
  }, [scoped, granularity]);
  if (!view) return null;
  const products = view.products.filter((p) =>
    p.product.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <SourceNote>
        Số lượng sản phẩm bán ra, tính từ các tab Đơn CH, Đơn NT (đơn Đã giao)
        và Đơn Bưu điện (Đã giao). Đơn sàn TikTok/Shopee chỉ có tiền, không có
        sản phẩm nên không gộp vào đây.
      </SourceNote>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Tổng số sản phẩm bán ra theo chi nhánh</CardTitle>
          <GranularityToggle value={granularity} onChange={setGranularity} />
        </CardHeader>
        <CardContent className="px-0">
          <MatrixTable matrix={view.matrix} format={qty} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Chi tiết từng sản phẩm ({products.length})</CardTitle>
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
                <TableHead>Sản phẩm</TableHead>
                {view.units.map((u) => (
                  <TableHead key={u.key} className="text-right">
                    <UnitLabel unit={u} />
                  </TableHead>
                ))}
                <TableHead className="text-right">Tổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.code || p.product}>
                  <TableCell className="max-w-96">
                    <span className="line-clamp-1" title={p.product}>
                      {p.product}
                    </span>
                    {p.code ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.code}
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-600"
                      >
                        chưa quy chuẩn
                      </Badge>
                    )}
                  </TableCell>
                  {view.units.map((u) => {
                    const v = p.perUnit.get(u.key) ?? 0;
                    return (
                      <TableCell
                        key={u.key}
                        className={
                          v ? "text-right" : "text-right text-muted-foreground"
                        }
                      >
                        {v ? qty(v) : "–"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">
                    {qty(p.total)}
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
