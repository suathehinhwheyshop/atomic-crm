import { Button } from "@/components/ui/button";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-1">
    {options.map((option) => (
      <Button
        key={option.value}
        size="sm"
        variant={option.value === value ? "default" : "outline"}
        aria-pressed={option.value === value}
        title={option.hint}
        onClick={() => onChange(option.value)}
      >
        {option.label}
        {option.hint ? (
          <span className="text-[10px] font-normal opacity-60">chưa nối</span>
        ) : null}
      </Button>
    ))}
  </div>
);
