import {
  addDays,
  format,
  parseISO,
  startOfMonth,
  subMonths,
  endOfMonth,
} from "date-fns";

import { Input } from "@/components/ui/input";

import { BRANCHES, LINES } from "../data/sources";
import type { BranchCode, GoodsLine } from "../model/types";
import { useFilters } from "./FiltersContext";
import { Segmented } from "./Segmented";

const iso = (date: Date) => format(date, "yyyy-MM-dd");

const periodPresets = (today: string) => {
  const now = parseISO(today);
  return [
    { label: "Hôm nay", from: today, to: today },
    { label: "7 ngày", from: iso(addDays(now, -6)), to: today },
    { label: "Tháng này", from: iso(startOfMonth(now)), to: today },
    {
      label: "Tháng trước",
      from: iso(startOfMonth(subMonths(now, 1))),
      to: iso(endOfMonth(subMonths(now, 1))),
    },
  ];
};

export const FilterBar = ({
  today,
  connectedBranches,
}: {
  today: string;
  connectedBranches: BranchCode[];
}) => {
  const { filters, setFilters } = useFilters();
  const presets = periodPresets(today);
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b bg-background/95 px-6 py-3">
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Cơ sở</div>
        <Segmented
          label="Cơ sở"
          value={filters.branch}
          onChange={(branch) => setFilters({ branch })}
          options={[
            { value: "ALL", label: "Tất cả" },
            ...BRANCHES.map((b) => ({
              value: b.code,
              label: b.label,
              hint: connectedBranches.includes(b.code)
                ? undefined
                : "Chưa kết nối file dữ liệu",
            })),
          ]}
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">
          Dòng hàng
        </div>
        <Segmented<GoodsLine | "ALL">
          label="Dòng hàng"
          value={filters.line}
          onChange={(line) => setFilters({ line })}
          options={[
            { value: "ALL", label: "Tất cả" },
            ...LINES.map((l) => ({ value: l.code, label: l.label })),
          ]}
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">
          Kỳ báo cáo
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Segmented
            label="Kỳ báo cáo"
            value={
              presets.find(
                (p) => p.from === filters.from && p.to === filters.to,
              )?.label ?? ""
            }
            onChange={(label) => {
              const preset = presets.find((p) => p.label === label);
              if (preset) setFilters({ from: preset.from, to: preset.to });
            }}
            options={presets.map((p) => ({ value: p.label, label: p.label }))}
          />
          <Input
            type="date"
            aria-label="Từ ngày"
            className="h-8 w-36"
            value={filters.from}
            onChange={(e) => setFilters({ from: e.target.value })}
          />
          <span className="text-muted-foreground">→</span>
          <Input
            type="date"
            aria-label="Đến ngày"
            className="h-8 w-36"
            value={filters.to}
            onChange={(e) => setFilters({ to: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};
