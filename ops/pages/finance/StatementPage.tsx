import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate, formatVnd } from "../../components/format";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel } from "../../components/UnitLabel";
import { useReportScope } from "../../components/useReportScope";
import {
  CHANNEL_ORDER,
  channelsByUnit,
  debtPeriods,
  fundPeriods,
  pendingMoney,
} from "../../model/finance";
import { CHANNEL_LABELS } from "../../model/parseWorkbook";
import { financialStatement, type BranchUnit } from "../../model/reports";

type Line = {
  label: string;
  values: Map<string, number>;
  strong?: boolean;
  muted?: boolean;
  note?: string;
  count?: boolean;
};
type Section = { title: string; lines: Line[] };

const byUnit = <T extends { unit: BranchUnit }>(
  rows: T[],
  value: (r: T) => number,
) => new Map(rows.map((r) => [r.unit.key, value(r)]));

export const StatementPage = () => {
  const { scoped, units, from, to, today } = useReportScope();
  const sections = useMemo((): Section[] => {
    if (!scoped) return [];
    const statement = financialStatement(scoped, units);
    const channels = channelsByUnit(scoped, units);
    const funds = fundPeriods(scoped, units, from, to);
    const debts = debtPeriods(scoped, units, from, to, today);
    const pending = pendingMoney(scoped, units);
    const hasCost = statement.some((r) => r.costCoverage > 0);
    const fund = (
      kind: "cash" | "bank",
      pick: (f: (typeof funds)[number]) => number,
    ) =>
      byUnit(
        funds.filter((f) => f.fund === kind),
        pick,
      );
    const sumFunds = (pick: (f: (typeof funds)[number]) => number) =>
      new Map(
        units.map((u) => [
          u.key,
          funds
            .filter((f) => f.unit.key === u.key)
            .reduce((t, f) => t + pick(f), 0),
        ]),
      );
    return [
      {
        title: "A. Doanh thu theo kênh",
        lines: [
          ...CHANNEL_ORDER.map((c) => ({
            label: CHANNEL_LABELS[c],
            values: byUnit(
              channels,
              (r) => r.channels.find((x) => x.channel === c)?.revenue ?? 0,
            ),
          })),
          {
            label: "Tổng doanh thu",
            values: byUnit(statement, (r) => r.revenue),
            strong: true,
          },
          {
            label: "Số đơn tính doanh thu",
            values: byUnit(statement, (r) => r.orders),
            muted: true,
            count: true,
          },
        ],
      },
      {
        title: "B. Kết quả kinh doanh",
        lines: [
          ...(hasCost
            ? [
                {
                  label: "Giá vốn hàng bán",
                  values: byUnit(statement, (r) => r.costOfGoods),
                  note: "theo Danh mục sản phẩm",
                },
                {
                  label: "Lợi nhuận gộp",
                  values: byUnit(statement, (r) => r.grossProfit),
                  strong: true,
                },
              ]
            : [
                {
                  label: "Giá vốn hàng bán",
                  values: new Map(),
                  note: "[CHƯA CÓ SỐ] – cần Danh mục sản phẩm có giá vốn",
                  muted: true,
                },
              ]),
          {
            label: "Chi phí vận hành (Bảng Chi phí)",
            values: byUnit(statement, (r) => r.expenses),
          },
          {
            label: hasCost
              ? "Lợi nhuận sau chi phí vận hành"
              : "Doanh thu − Chi phí vận hành",
            values: byUnit(statement, (r) =>
              hasCost ? r.operatingResult : r.revenue - r.expenses,
            ),
            strong: true,
            note: hasCost ? undefined : "chưa trừ giá vốn",
          },
        ],
      },
      {
        title: `C. Sổ quỹ (${formatDate(from)} → ${formatDate(to)})`,
        lines: [
          { label: "Tiền mặt đầu kỳ", values: fund("cash", (f) => f.opening) },
          { label: "Ngân hàng đầu kỳ", values: fund("bank", (f) => f.opening) },
          { label: "Tổng thu trong kỳ", values: sumFunds((f) => f.inflow) },
          { label: "Tổng chi trong kỳ", values: sumFunds((f) => f.outflow) },
          { label: "Tiền mặt cuối kỳ", values: fund("cash", (f) => f.closing) },
          {
            label: "Ngân hàng cuối kỳ",
            values: fund("bank", (f) => f.closing),
          },
          {
            label: "Tổng tồn quỹ cuối kỳ",
            values: sumFunds((f) => f.closing),
            strong: true,
          },
          {
            label: "MPOS chờ về (chưa vào ngân hàng)",
            values: byUnit(pending, (p) => p.pendingCards),
            muted: true,
          },
        ],
      },
      {
        title: "D. Công nợ nhà cung cấp",
        lines: [
          { label: "Nợ đầu kỳ", values: byUnit(debts, (d) => d.opening) },
          {
            label: "Nhập hàng trong kỳ",
            values: byUnit(debts, (d) => d.purchased),
          },
          { label: "Đã trả trong kỳ", values: byUnit(debts, (d) => d.paid) },
          {
            label: "Nợ cuối kỳ",
            values: byUnit(debts, (d) => d.closing),
            strong: true,
          },
          {
            label: "Trong đó quá hạn",
            values: byUnit(debts, (d) => d.overdue),
            muted: true,
          },
        ],
      },
      {
        title: "E. Tiền chưa vào Sổ quỹ",
        lines: [
          {
            label: "Nội thành đã giao chưa thu",
            values: byUnit(pending, (p) => p.localUnpaid),
          },
          {
            label: "Bưu điện đang giao",
            values: byUnit(pending, (p) => p.postNotDelivered),
          },
          {
            label: "COD đã thu hộ chưa về sổ",
            values: byUnit(pending, (p) => p.codCollected),
          },
          {
            label: "Tiền sàn chưa rút",
            values: byUnit(pending, (p) => p.platformNet),
          },
          {
            label: "Đơn lỗi kiểm tra (chưa vào sổ)",
            values: byUnit(pending, (p) => p.orderIssues),
            muted: true,
          },
        ],
      },
    ];
  }, [scoped, units, from, to, today]);
  if (!scoped) return null;
  const cell = (line: Line, v: number | undefined) =>
    v == null ? "–" : line.count ? v.toLocaleString("vi-VN") : formatVnd(v);
  const total = (line: Line) =>
    line.values.size
      ? [...line.values.values()].reduce((t, v) => t + v, 0)
      : undefined;
  const cls = (line: Line) =>
    line.strong ? "font-semibold" : line.muted ? "text-muted-foreground" : "";

  return (
    <div className="space-y-4">
      <SourceNote>
        Báo cáo gộp cho kỳ đang chọn (mặc định tháng này; chọn "Tháng trước" ở
        thanh lọc để xem tháng trước). Doanh thu và chi phí cộng trong kỳ; sổ
        quỹ và công nợ có số đầu kỳ, phát sinh, cuối kỳ. Công nợ NCC lấy từ tab
        đề xuất, hiện là demo.
      </SourceNote>
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo tài chính gộp theo chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">Chỉ tiêu</TableHead>
                {units.map((u) => (
                  <TableHead key={u.key} className="text-right">
                    <UnitLabel unit={u} />
                  </TableHead>
                ))}
                <TableHead className="text-right">Toàn hệ thống</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <>
                  <TableRow
                    key={section.title}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell
                      colSpan={units.length + 2}
                      className="font-semibold"
                    >
                      {section.title}
                    </TableCell>
                  </TableRow>
                  {section.lines.map((line) => (
                    <TableRow key={`${section.title}-${line.label}`}>
                      <TableCell className={cls(line)}>
                        {line.label}
                        {line.note ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {line.note}
                          </span>
                        ) : null}
                      </TableCell>
                      {units.map((u) => (
                        <TableCell
                          key={u.key}
                          className={`text-right ${cls(line)}`}
                        >
                          {cell(line, line.values.get(u.key))}
                        </TableCell>
                      ))}
                      <TableCell className={`text-right ${cls(line)}`}>
                        {cell(line, total(line))}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
