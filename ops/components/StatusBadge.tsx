import { Badge } from "@/components/ui/badge";

export const CheckBadge = ({ check }: { check: string }) =>
  check.startsWith("OK") ? (
    <Badge variant="secondary">OK</Badge>
  ) : (
    <Badge variant="destructive">{check || "Chưa kiểm tra"}</Badge>
  );

const DELIVERY_TONE: Record<string, string> = {
  "Đã giao":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "Đang giao": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "Hoàn-Huỷ": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export const DeliveryBadge = ({ status }: { status: string }) => (
  <Badge
    variant="outline"
    className={DELIVERY_TONE[status] ?? "text-muted-foreground"}
  >
    {status || "—"}
  </Badge>
);

export const PaymentBadge = ({ status }: { status: string }) => (
  <Badge variant={status === "Đã thanh toán" ? "outline" : "destructive"}>
    {status || "—"}
  </Badge>
);
