import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate, formatVnd } from "../components/format";
import { OrderSheet } from "../components/OrderSheet";
import { Segmented } from "../components/Segmented";
import {
  CheckBadge,
  DeliveryBadge,
  PaymentBadge,
} from "../components/StatusBadge";
import { useScopedData } from "../components/useScopedData";
import { CHANNEL_LABELS, normalizePhone } from "../model/parseWorkbook";
import type { Channel, Order } from "../model/types";

const PAGE_SIZE = 100;

type ChannelFilter = Channel | "ALL";
type StatusFilter = "ALL" | "ISSUE" | "UNPAID" | "UNDELIVERED";

const matchesStatus = (o: Order, status: StatusFilter) =>
  status === "ALL" ||
  (status === "ISSUE" && !o.check.startsWith("OK")) ||
  (status === "UNPAID" && o.paymentStatus !== "Đã thanh toán") ||
  (status === "UNDELIVERED" &&
    !["Đã giao", "Hoàn-Huỷ"].includes(o.deliveryStatus));

export const OrdersPage = () => {
  const { scoped } = useScopedData();
  const [channel, setChannel] = useState<ChannelFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Order | null>(null);

  const isPlatform = channel === "tiktok" || channel === "shopee";
  const orders = useMemo(() => {
    if (!scoped) return [];
    const text = search.trim().toLowerCase();
    const digits = normalizePhone(search);
    return scoped.orders
      .filter((o) => channel === "ALL" || o.channel === channel)
      .filter((o) => matchesStatus(o, status))
      .filter(
        (o) =>
          !text ||
          o.code.toLowerCase().includes(text) ||
          o.customer.toLowerCase().includes(text) ||
          (digits.length >= 3 && o.phone.includes(digits)),
      )
      .sort(
        (a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code),
      );
  }, [scoped, channel, status, search]);
  const platformOrders = useMemo(
    () =>
      (scoped?.platformOrders ?? [])
        .filter((o) => o.channel === channel)
        .filter(
          (o) => !search || o.code.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [scoped, channel, search],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<ChannelFilter>
          label="Kênh"
          value={channel}
          onChange={(value) => {
            setChannel(value);
            setLimit(PAGE_SIZE);
          }}
          options={[
            { value: "ALL", label: "Tất cả" },
            ...(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => ({
              value: c,
              label: CHANNEL_LABELS[c],
            })),
          ]}
        />
        <Input
          placeholder="Tìm mã đơn, tên khách, SĐT…"
          className="h-8 w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!isPlatform ? (
          <Segmented<StatusFilter>
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "Mọi trạng thái" },
              { value: "ISSUE", label: "Lỗi kiểm tra" },
              { value: "UNPAID", label: "Chưa thanh toán" },
              { value: "UNDELIVERED", label: "Chưa giao" },
            ]}
          />
        ) : null}
      </div>

      <Card>
        <CardContent className="px-0">
          {isPlatform ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>ID đơn sàn</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Phí sàn</TableHead>
                  <TableHead className="text-right">Thực nhận</TableHead>
                  <TableHead>Hệ thống</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformOrders.slice(0, limit).map((o) => (
                  <TableRow key={o.key}>
                    <TableCell>{formatDate(o.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.code}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(o.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(o.fee)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(o.netRevenue)}
                    </TableCell>
                    <TableCell>
                      <CheckBadge check={o.check} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Kênh</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Giao hàng</TableHead>
                  <TableHead>Kiểm tra</TableHead>
                  <TableHead>NV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, limit).map((o) => (
                  <TableRow
                    key={o.key}
                    className="cursor-pointer"
                    onClick={() => setSelected(o)}
                  >
                    <TableCell>{formatDate(o.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.code}
                    </TableCell>
                    <TableCell>{CHANNEL_LABELS[o.channel]}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.customer || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.phone}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span
                        className="line-clamp-1"
                        title={o.items.map((i) => i.product).join("\n")}
                      >
                        {o.items[0]?.product ?? "—"}
                      </span>
                      {o.items.length > 1 ? (
                        <span className="text-xs text-muted-foreground">
                          +{o.items.length - 1} sản phẩm
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatVnd(o.total)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {o.paymentMethod}
                      </div>
                      <PaymentBadge status={o.paymentStatus} />
                    </TableCell>
                    <TableCell>
                      <DeliveryBadge status={o.deliveryStatus} />
                    </TableCell>
                    <TableCell>
                      <CheckBadge check={o.check} />
                    </TableCell>
                    <TableCell className="text-xs">{o.staff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Hiển thị{" "}
          {Math.min(limit, isPlatform ? platformOrders.length : orders.length)}{" "}
          / {isPlatform ? platformOrders.length : orders.length} đơn
        </span>
        {limit < (isPlatform ? platformOrders.length : orders.length) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit(limit + PAGE_SIZE)}
          >
            Xem thêm
          </Button>
        ) : null}
      </div>
      <OrderSheet order={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
