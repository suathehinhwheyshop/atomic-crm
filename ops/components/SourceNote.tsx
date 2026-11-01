import { Info } from "lucide-react";

/** Where the numbers on a page come from, and whether the tab exists in the real files yet. */
export const SourceNote = ({
  children,
  proposed,
}: {
  children: React.ReactNode;
  proposed?: boolean;
}) => (
  <div
    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${proposed ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-muted/50 text-muted-foreground"}`}
  >
    <Info className="mt-0.5 size-3.5 shrink-0" />
    <div>
      {proposed ? (
        <strong>
          Tab đề xuất, chưa có trong file hiện tại – số bên dưới là demo.{" "}
        </strong>
      ) : null}
      {children}
    </div>
  </div>
);
