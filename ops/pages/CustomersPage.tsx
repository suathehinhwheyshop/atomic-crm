import { MessageCircle, Phone } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCompact, formatDate, formatVnd } from "../components/format";
import { Kpi } from "../components/Kpi";
import { Segmented } from "../components/Segmented";
import { useScopedData } from "../components/useScopedData";
import {
  buildCustomers,
  type Customer,
  type CustomerSegment,
} from "../model/metrics";
import { CHANNEL_LABELS, normalizePhone } from "../model/parseWorkbook";

const PAGE_SIZE = 100;

const SEGMENT_TONE: Record<CustomerSegment, string> = {
  VIP: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "Quay lại":
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  Mới: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300",
};

const SegmentBadge = ({ segment }: { segment: CustomerSegment }) => (
  <Badge variant="outline" className={SEGMENT_TONE[segment]}>
    {segment}
  </Badge>
);

const CustomerSheet = ({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) => (
  <Sheet
    open={Boolean(customer)}
    onOpenChange={(open) => (open ? null : onClose())}
  >
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      {customer ? (
        <>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {customer.name} <SegmentBadge segment={customer.segment} />
            </SheetTitle>
            <SheetDescription>
              {customer.phone || "Không có SĐT"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {customer.phone ? (
              <div className="flex gap-2">
                <a
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`tel:${customer.phone}`}
                >
                  <Phone /> Gọi
                </a>
                <a
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`https://zalo.me/${customer.phone}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle /> Zalo
                </a>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Số đơn</div>
                <div className="font-semibold">{customer.orderCount}</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Tổng chi</div>
                <div className="font-semibold">
                  {formatCompact(customer.spent)}
                </div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Lần đầu</div>
                <div className="font-semibold">
                  {formatDate(customer.firstDate)}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Lịch sử mua hàng</div>
              <div className="space-y-2">
                {customer.orders.map((o) => (
                  <div key={o.key} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {formatDate(o.date)} · {o.code}
                      </span>
                      <span className="font-semibold">
                        {formatVnd(o.total)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {CHANNEL_LABELS[o.channel]} · {o.branch} {o.line} ·{" "}
                      {o.deliveryStatus}
                    </div>
                    <ul className="mt-1 list-inside list-disc text-xs">
                      {o.items.map((i, index) => (
                        <li key={index}>
                          {i.product} × {i.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </SheetContent>
  </Sheet>
);

export const CustomersPage = () => {
  const { scoped } = useScopedData();
  const [segment, setSegment] = useState<CustomerSegment | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Customer | null>(null);

  const customers = useMemo(
    () => buildCustomers(scoped?.orders ?? []),
    [scoped],
  );
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    const digits = normalizePhone(search);
    return customers
      .filter((c) => segment === "ALL" || c.segment === segment)
      .filter(
        (c) =>
          !text ||
          c.name.toLowerCase().includes(text) ||
          (digits.length >= 3 && c.phone.includes(digits)),
      );
  }, [customers, segment, search]);
  const count = (s: CustomerSegment) =>
    customers.filter((c) => c.segment === s).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Tổng khách hàng"
          value={customers.length.toLocaleString("vi-VN")}
          hint="Gộp theo SĐT trên mọi kênh"
        />
        <Kpi
          label="VIP"
          value={String(count("VIP"))}
          hint="Chi từ 10 triệu trong kỳ"
        />
        <Kpi
          label="Quay lại"
          value={String(count("Quay lại"))}
          hint="Từ 2 đơn trở lên"
        />
        <Kpi
          label="Khách mới"
          value={String(count("Mới"))}
          hint="1 đơn trong kỳ"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<CustomerSegment | "ALL">
          label="Phân khúc"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "ALL", label: "Tất cả" },
            { value: "VIP", label: "VIP" },
            { value: "Quay lại", label: "Quay lại" },
            { value: "Mới", label: "Mới" },
          ]}
        />
        <Input
          placeholder="Tìm tên hoặc SĐT…"
          className="h-8 w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Phân khúc</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Tổng chi</TableHead>
                <TableHead>Mua gần nhất</TableHead>
                <TableHead>Kênh</TableHead>
                <TableHead>Sản phẩm mua nhiều</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.slice(0, limit).map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(c)}
                >
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <SegmentBadge segment={c.segment} />
                  </TableCell>
                  <TableCell className="text-right">{c.orderCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatVnd(c.spent)}
                  </TableCell>
                  <TableCell>{formatDate(c.lastDate)}</TableCell>
                  <TableCell className="text-xs">
                    {c.channels.map((ch) => CHANNEL_LABELS[ch]).join(", ")}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="line-clamp-1" title={c.topProduct}>
                      {c.topProduct}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Hiển thị {Math.min(limit, visible.length)} / {visible.length} khách
        </span>
        {limit < visible.length ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit(limit + PAGE_SIZE)}
          >
            Xem thêm
          </Button>
        ) : null}
      </div>
      <CustomerSheet customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
