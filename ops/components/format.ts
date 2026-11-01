export const formatVnd = (amount: number) =>
  `${Math.round(amount).toLocaleString("vi-VN")} ₫`;

/** 237137000 -> "237,1 tr" */
export const formatCompact = (amount: number) => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000)
    return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (abs >= 1_000_000)
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
};

/** "2026-10-21" -> "21/10/2026" */
export const formatDate = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return year ? `${day}/${month}/${year}` : "";
};
