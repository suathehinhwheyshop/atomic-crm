import type { Granularity } from "../model/period";
import { Segmented } from "./Segmented";

export const GranularityToggle = ({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) => (
  <Segmented<Granularity>
    label="Theo tuần hoặc tháng"
    value={value}
    onChange={onChange}
    options={[
      { value: "week", label: "Theo tuần" },
      { value: "month", label: "Theo tháng" },
    ]}
  />
);
