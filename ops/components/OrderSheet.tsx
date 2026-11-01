import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { CHANNEL_LABELS } from "../model/parseWorkbook";
import type { Order } from "../model/types";
import { formatDate, formatVnd } from "./format";
import { CheckBadge, DeliveryBadge, PaymentBadge } from "./StatusBadge";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{value || "—"}</span>
  </div>
);

export const OrderSheet = ({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) => (
  <Sheet
    open={Boolean(order)}
    onOpenChange={(open) => (open ? null : onClose())}
  >
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      {order ? (
        <>
          <SheetHeader>
            <SheetTitle>Đơn {order.code}</SheetTitle>
            <SheetDescription>
              {CHANNEL_LABELS[order.channel]} · {order.branch} {order.line} ·{" "}
              {formatDate(order.date)}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              <CheckBadge check={order.check} />
              <PaymentBadge status={order.paymentStatus} />
              <DeliveryBadge status={order.deliveryStatus} />
            </div>
            <div className="divide-y rounded-lg border px-3">
              <Field label="Khách hàng" value={order.customer} />
              <Field label="SĐT" value={order.phone} />
              <Field label="Địa chỉ" value={order.address} />
              <Field label="Nguồn" value={order.source} />
              <Field
                label="Nhân viên / Ca"
                value={`${order.staff || "—"} · ${order.shift || "—"}`}
              />
              {order.postType ? (
                <Field label="Loại đơn BĐ" value={order.postType} />
              ) : null}
            </div>
            <div className="rounded-lg border">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between gap-3 border-b px-3 py-2 text-sm last:border-0"
                >
                  <span>{item.product}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.quantity} × {formatVnd(item.unitPrice)}
                    {item.discount ? ` − ${formatVnd(item.discount)}` : ""}
                  </span>
                </div>
              ))}
            </div>
            <div className="divide-y rounded-lg border px-3">
              <Field
                label="Phí ship thu khách"
                value={formatVnd(order.shippingFee)}
              />
              <Field
                label="Tổng khách trả"
                value={<strong>{formatVnd(order.total)}</strong>}
              />
              <Field label="Hình thức TT" value={order.paymentMethod} />
              <Field
                label="Tiền mặt / CK / Thẻ / COD"
                value={`${formatVnd(order.cash)} / ${formatVnd(order.bank)} / ${formatVnd(order.card)} / ${formatVnd(order.cod)}`}
              />
              <Field
                label="Doanh thu được tính"
                value={formatVnd(order.revenue)}
              />
              <Field
                label="Sổ quỹ"
                value={order.inCashbook ? "Đã vào sổ quỹ" : "Chưa vào sổ"}
              />
            </div>
          </div>
        </>
      ) : null}
    </SheetContent>
  </Sheet>
);
