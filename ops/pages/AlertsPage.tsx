import { AlertCircle, AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { formatDate } from "../components/format";
import { useScopedData } from "../components/useScopedData";
import { buildAlerts } from "../model/metrics";

export const AlertsPage = () => {
  const { loaded, scoped } = useScopedData();
  const alerts = useMemo(
    () => (scoped && loaded ? buildAlerts(scoped, loaded.today) : []),
    [scoped, loaded],
  );
  const errors = alerts.filter((a) => a.level === "error");
  const warnings = alerts.filter((a) => a.level === "warning");

  if (!alerts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Không có việc cần xử lý trong kỳ này.
      </p>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[
        {
          title: "Lỗi – chưa vào Sổ quỹ / lệch tiền",
          list: errors,
          icon: <AlertCircle className="size-4 text-destructive" />,
        },
        {
          title: "Cần theo dõi",
          list: warnings,
          icon: <AlertTriangle className="size-4 text-amber-500" />,
        },
      ].map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            {group.icon} {group.title} ({group.list.length})
          </h2>
          {group.list.map((a) => (
            <Card key={a.key} size="sm">
              <CardContent>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(a.date)} · {a.branch} {a.line} · {a.detail}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
};
