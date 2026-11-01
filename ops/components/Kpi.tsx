import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export const Kpi = ({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "warning";
}) => (
  <Card size="sm">
    <CardContent className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={
          tone === "warning"
            ? "text-2xl font-semibold text-amber-600"
            : "text-2xl font-semibold"
        }
      >
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </CardContent>
  </Card>
);
