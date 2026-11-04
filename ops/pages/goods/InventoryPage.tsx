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
import { useReportScope } from "../../components/useReportScope";
import { branchLabel } from "../../data/sources";
import { purchaseOrdersSummary, stockSummary } from "../../model/accounting";
import { createMatcher } from "../../model/catalog";
import type { BranchCode } from "../../model/types";

const qty = (v: number) => v.toLocaleString("vi-VN");

export const InventoryPage = () => {
  const { scoped, today } = useReportScope();
  const [search, setSearch] = useState("");
  const view = useMemo(() => {
    if (!scoped) return null;
    const match = createMatcher(scoped.catalog);
    const costOf = (product: string) => match(product)?.costPrice ?? 0;
    return {
      stock: stockSummary(scoped.stock, costOf),
      orders: purchaseOrdersSummary(scoped.purchaseOrders, today),
      rows: scoped.stock,
      openOrders: scoped.purchaseOrders.filter(
        (o) => !o.cancelled && o.missing > 0,
      ),
      receipts: [...scoped.receipts]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50),
      costOf,
    };
  }, [scoped, today]);
  if (!view) return null;
  if (!view.rows.length && !view.openOrders.length && !view.receipts.length) {
    return (
      <SourceNote>
        Chưa nối file "HÀNG HÓA - KHO" nào. Thêm file Kho của HN và SG vào danh
        sách nguồn là trang này tự hiện tồn hàng xách tay, hàng công ty đã đặt
        và mới về.
      </SourceNote>
    );
  }
  const rows = view.rows.filter((r) =>
    r.product.toLowerCase().includes(search.toLowerCase()),
  );
  const totalClosing = view.stock.reduce((t, s) => t + s.closing, 0);
  const totalValue = view.stock.reduce((t, s) => t + s.value, 0);
  const pendingAmount = view.orders.reduce((t, o) => t + o.pendingAmount, 0);

  return (
    <div className="space-y-4">
      <SourceNote>
        Hàng xách tay: tab "Hàng xách tay tồn kho" của file Kho (tồn đầu, nhập,
        bán, chuyển chi nhánh, tồn cuối, cảnh báo). Hàng công ty: tồn nằm trong
        Sapo, file Kho chỉ theo dõi đơn đã đặt NCC và hàng mới về. Giá trị tồn =
        tồn cuối × Giá nhập trong Danh mục file Kho.
      </SourceNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Tồn hàng xách tay (đơn vị)"
          value={qty(totalClosing)}
          hint={`${view.stock.reduce((t, s) => t + s.products, 0)} mặt hàng`}
        />
        <Kpi
          label="Giá trị tồn HXT"
          value={formatCompact(totalValue)}
          hint={totalValue ? formatVnd(totalValue) : "Chưa có giá nhập"}
        />
        <Kpi
          label="Hết / sắp hết hàng"
          value={String(view.stock.reduce((t, s) => t + s.outOfStock, 0))}
          tone={view.stock.some((s) => s.outOfStock) ? "warning" : "default"}
        />
        <Kpi
          label="Hàng công ty chờ về"
          value={formatCompact(pendingAmount)}
          hint={`${view.orders.reduce((t, o) => t + o.openLines, 0)} dòng chưa nhận đủ · ${view.orders.reduce((t, o) => t + o.overdue, 0)} quá hạn`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tóm tắt theo kho</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kho</TableHead>
                <TableHead className="text-right">Mặt hàng HXT</TableHead>
                <TableHead className="text-right">Tồn HXT</TableHead>
                <TableHead className="text-right">Giá trị tồn</TableHead>
                <TableHead className="text-right">Hết hàng</TableHead>
                <TableHead className="text-right">Cận hạn</TableHead>
                <TableHead className="text-right">HCT đã đặt chưa về</TableHead>
                <TableHead className="text-right">Quá hạn về</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ...new Set([
                  ...view.stock.map((s) => s.branch),
                  ...view.orders.map((o) => o.branch),
                ]),
              ].map((branch) => {
                const s = view.stock.find((x) => x.branch === branch);
                const o = view.orders.find((x) => x.branch === branch);
                return (
                  <TableRow key={branch}>
                    <TableCell className="font-medium">
                      {branchLabel(branch as BranchCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      {s?.products ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s ? qty(s.closing) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s?.value ? formatVnd(s.value) : "–"}
                    </TableCell>
                    <TableCell
                      className={
                        s?.outOfStock
                          ? "text-right text-amber-600"
                          : "text-right"
                      }
                    >
                      {s?.outOfStock ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s?.expiring ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {o ? formatVnd(o.pendingAmount) : "–"}
                    </TableCell>
                    <TableCell
                      className={
                        o?.overdue
                          ? "text-right text-destructive"
                          : "text-right"
                      }
                    >
                      {o?.overdue ?? "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Tồn kho hàng xách tay ({rows.length})</CardTitle>
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
                <TableHead>Kho</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Đầu kỳ</TableHead>
                <TableHead className="text-right">Nhập</TableHead>
                <TableHead className="text-right">Bán</TableHead>
                <TableHead className="text-right">Chuyển CN</TableHead>
                <TableHead className="text-right">Tồn cuối</TableHead>
                <TableHead>HSD gần nhất</TableHead>
                <TableHead>Cảnh báo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{branchLabel(r.branch)}</TableCell>
                  <TableCell className="max-w-96">
                    <span className="line-clamp-1" title={r.product}>
                      {r.product}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{qty(r.opening)}</TableCell>
                  <TableCell className="text-right">
                    {qty(r.received)}
                  </TableCell>
                  <TableCell className="text-right">{qty(r.sold)}</TableCell>
                  <TableCell className="text-right">
                    {qty(r.transferred)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {qty(r.closing)}
                  </TableCell>
                  <TableCell>{formatDate(r.expiry) || "–"}</TableCell>
                  <TableCell>
                    {r.warning && r.warning !== "OK" ? (
                      <Badge variant="destructive">{r.warning}</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>Tổng</TableCell>
                <TableCell className="text-right">
                  {qty(rows.reduce((t, r) => t + r.closing, 0))}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Hàng công ty đã đặt, chưa về đủ ({view.openOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày đặt</TableHead>
                  <TableHead>PO · NCC</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">Còn thiếu</TableHead>
                  <TableHead>Dự kiến về</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.openOrders.map((o) => (
                  <TableRow key={o.key}>
                    <TableCell>{formatDate(o.date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{o.po}</span>
                      <div className="text-xs text-muted-foreground">
                        {o.supplier}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-1" title={o.product}>
                        {o.product}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(o.missing)} / {qty(o.ordered)}
                    </TableCell>
                    <TableCell
                      className={
                        o.expected && o.expected < today
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {formatDate(o.expected) || "–"}
                    </TableCell>
                  </TableRow>
                ))}
                {view.openOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Không có đơn đặt đang chờ.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hàng công ty mới về (50 dòng gần nhất)</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày nhận</TableHead>
                  <TableHead>PO · NCC</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.receipts.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{r.po}</span>
                      <div className="text-xs text-muted-foreground">
                        {r.supplier}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-1" title={r.product}>
                        {r.product}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(r.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {view.receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Chưa có hàng về trong kỳ.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
