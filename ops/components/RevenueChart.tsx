import { ResponsiveBar } from "@nivo/bar";

import type { DailyRevenue } from "../model/metrics";
import { CHANNEL_LABELS } from "../model/parseWorkbook";
import type { Channel } from "../model/types";
import { formatCompact, formatDate, formatVnd } from "./format";

const KEYS: Channel[] = ["store", "local", "post", "tiktok", "shopee"];
const CHANNEL_COLORS: Record<Channel, string> = {
  store: "#2563eb",
  local: "#16a34a",
  post: "#f59e0b",
  tiktok: "#111827",
  shopee: "#ea580c",
};

export const RevenueChart = ({ days }: { days: DailyRevenue[] }) => {
  if (!days.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Không có doanh thu trong kỳ này
      </div>
    );
  }
  const data = days.map((d) => ({
    ...d,
    label: formatDate(d.date).slice(0, 5),
  }));
  return (
    <div className="h-72">
      <ResponsiveBar
        data={data}
        indexBy="label"
        keys={KEYS}
        colors={({ id }) => CHANNEL_COLORS[id as Channel]}
        margin={{ top: 10, right: 10, bottom: 30, left: 56 }}
        padding={0.25}
        enableLabel={false}
        axisLeft={{ format: (v) => formatCompact(Number(v)), tickSize: 0 }}
        axisBottom={{ tickSize: 0, tickRotation: data.length > 16 ? -45 : 0 }}
        gridYValues={5}
        tooltip={({ id, value, indexValue }) => (
          <div className="rounded bg-popover px-2 py-1 text-xs shadow ring-1 ring-foreground/10">
            {indexValue} · {CHANNEL_LABELS[id as Channel]}:{" "}
            <strong>{formatVnd(Number(value))}</strong>
          </div>
        )}
        theme={{ text: { fill: "var(--muted-foreground)", fontSize: 11 } }}
      />
    </div>
  );
};

export const ChannelLegend = () => (
  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
    {KEYS.map((key) => (
      <span key={key} className="inline-flex items-center gap-1">
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ background: CHANNEL_COLORS[key] }}
        />
        {CHANNEL_LABELS[key]}
      </span>
    ))}
  </div>
);
