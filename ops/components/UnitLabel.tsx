import { LINE_LABELS, branchLabel } from "../data/sources";
import type { BranchUnit } from "../model/reports";

export const unitLabel = (unit: BranchUnit) =>
  unit.line === "GOP"
    ? branchLabel(unit.branch)
    : `${branchLabel(unit.branch)} · ${LINE_LABELS[unit.line]}`;

export const UnitLabel = ({ unit }: { unit: BranchUnit }) => (
  <span>
    <span className="font-medium">{branchLabel(unit.branch)}</span>
    {unit.line === "GOP" ? (
      <span className="ml-1 text-xs text-muted-foreground">gộp</span>
    ) : (
      <span className="ml-1 text-xs text-muted-foreground">
        {LINE_LABELS[unit.line]}
      </span>
    )}
  </span>
);
