import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCompact, formatVnd } from "../../components/format";
import { Segmented } from "../../components/Segmented";
import { SourceNote } from "../../components/SourceNote";
import { UnitLabel, unitLabel } from "../../components/UnitLabel";
import { useReportScope } from "../../components/useReportScope";
import {
  KEY_LINES,
  activeMonths,
  keyLineValue,
  pnlForUnit,
} from "../../model/accounting";
import type { BranchUnit } from "../../model/reports";

const money = (v: number) =>
  v ? formatVnd(v) : <span className="text-muted-foreground">–</span>;

export const PnlPage = () => {
  const { scoped, units, to } = useReportScope();
  const unitsWithPnl = useMemo(
    () =>
      units.filter((u) =>
        scoped?.pnl.some((l) => l.branch === u.branch && l.line === u.line),
      ),
    [units, scoped],
  );
  const [unitKeySel, setUnitKeySel] = useState<string>("");
  const unit: BranchUnit | undefined =
    unitsWithPnl.find((u) => u.key === unitKeySel) ?? unitsWithPnl[0];
  const lines = useMemo(
    () => (scoped && unit ? pnlForUnit(scoped, unit) : []),
    [scoped, unit],
  );
  const months = useMemo(() => activeMonths(lines), [lines]);
  const selectedMonth = Number(to.slice(5, 7)) || months.at(-1) || 1;
  if (!scoped) return null;
  if (!unitsWithPnl.length) {
    return (
      <SourceNote>
        Chưa nối file BCTC nào (tab "BCTC tháng" / "Báo cáo tài chính"). Thêm
        file BCTC từng chi nhánh vào danh sách nguồn là trang này tự hiện.
      </SourceNote>
    );
  }
  const sections = [...new Set(lines.map((l) => l.section))];

  return (
    <div className="space-y-4">
      <SourceNote>
        Đọc nguyên bảng "BCTC tháng" (HN, Q10) / "Báo cáo tài chính" (ĐN, Vinh)
        của file BCTC: số do kế toán chốt, có giá vốn. Cột tháng chỉ hiện các
        tháng có số. Bảng so sánh lấy tháng cuối của kỳ đang lọc.
      </SourceNote>
      <Card>
        <CardHeader>
          <CardTitle>So sánh chi nhánh · tháng {selectedMonth}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chỉ tiêu</TableHead>
                {unitsWithPnl.map((u) => (
                  <TableHead key={u.key} className="text-right">
                    <UnitLabel unit={u} />
                  </TableHead>
                ))}
                <TableHead className="text-right">Toàn hệ thống</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {KEY_LINES.map((key) => {
                const values = unitsWithPnl.map((u) =>
                  keyLineValue(pnlForUnit(scoped, u), key, selectedMonth),
                );
                const strong = key.id === "revenue" || key.id === "net";
                return (
                  <TableRow key={key.id}>
                    <TableCell className={strong ? "font-semibold" : ""}>
                      {key.label}
                    </TableCell>
                    {values.map((v, i) => (
                      <TableCell
                        key={i}
                        className={`text-right ${strong ? "font-semibold" : ""}`}
                      >
                        {money(v)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right ${strong ? "font-semibold" : ""}`}
                    >
                      {money(values.reduce((t, v) => t + v, 0))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>BCTC tháng · {unit ? unitLabel(unit) : ""}</CardTitle>
          <Segmented
            label="Chi nhánh"
            value={unit?.key ?? ""}
            onChange={setUnitKeySel}
            options={unitsWithPnl.map((u) => ({
              value: u.key,
              label: unitLabel(u),
            }))}
          />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-80">Khoản mục</TableHead>
                {months.map((m) => (
                  <TableHead key={m} className="text-right">
                    T{m}
                  </TableHead>
                ))}
                <TableHead className="text-right">Tổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <>
                  <TableRow
                    key={section}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell
                      colSpan={months.length + 2}
                      className="font-semibold"
                    >
                      {section || "—"}
                    </TableCell>
                  </TableRow>
                  {lines
                    .filter((l) => l.section === section)
                    .map((l) => (
                      <TableRow key={`${section}-${l.label}`}>
                        <TableCell
                          className={
                            l.emphasis
                              ? "font-semibold"
                              : "pl-6 text-muted-foreground"
                          }
                        >
                          {l.label}
                        </TableCell>
                        {months.map((m) => (
                          <TableCell
                            key={m}
                            className={`text-right ${l.emphasis ? "font-semibold" : ""}`}
                          >
                            {l.months[m - 1]
                              ? formatCompact(l.months[m - 1])
                              : "–"}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`text-right ${l.emphasis ? "font-semibold" : ""}`}
                        >
                          {l.total ? formatCompact(l.total) : "–"}
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
