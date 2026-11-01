import type { BranchCode } from "../model/types";

export const BRANCHES: Array<{ code: BranchCode; label: string }> = [
  { code: "HN", label: "Hà Nội" },
  { code: "HCM", label: "Hồ Chí Minh" },
  { code: "VINH", label: "Vinh" },
  { code: "DN", label: "Đà Nẵng" },
];

export const LINES = [
  { code: "HCT", label: "Hàng công ty" },
  { code: "HXT", label: "Hàng xách tay" },
  { code: "GOP", label: "Gộp (Vinh, ĐN)" },
] as const;

export const LINE_LABELS: Record<string, string> = {
  HCT: "Cty",
  HXT: "XT",
  GOP: "Gộp",
};

export const branchLabel = (code: BranchCode): string =>
  BRANCHES.find((b) => b.code === code)?.label ?? code;
