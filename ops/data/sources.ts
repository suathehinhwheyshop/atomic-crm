import type { BranchCode } from "../model/types";

export const BRANCHES: Array<{ code: BranchCode; label: string }> = [
  { code: "HN", label: "Hà Nội" },
  { code: "SG", label: "Sài Gòn" },
  { code: "VINH", label: "Vinh" },
  { code: "DN", label: "Đà Nẵng" },
];

export const LINES = [
  { code: "HCT", label: "Hàng công ty" },
  { code: "HXT", label: "Hàng xách tay" },
] as const;
