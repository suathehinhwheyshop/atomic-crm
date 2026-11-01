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

import { formatDate, formatVnd } from "../components/format";
import { Kpi } from "../components/Kpi";
import { CheckBadge } from "../components/StatusBadge";
import { useScopedData } from "../components/useScopedData";
import { cashByGroup, fundFlows } from "../model/metrics";

export const CashbookPage = () => {
  const { scoped } = useScopedData();
  const view = useMemo(
    () =>
      scoped
        ? {
            flows: fundFlows(scoped),
            groups: cashByGroup(scoped.cashEntries),
            entries: [...scoped.cashEntries].sort((a, b) =>
              b.date.localeCompare(a.date),
            ),
            pending: [...scoped.pendingCards].sort(
              (a, b) => b.waitingDays - a.waitingDays,
            ),
          }
        : null,
    [scoped],
  );
  if (!view) return null;
  const { flows, groups, entries, pending } = view;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {flows.map((f) => (
          <Kpi
            key={f.fund}
            label={`${f.fund} · phát sinh trong kỳ`}
            value={formatVnd(f.inflow - f.outflow)}
            hint={`Thu ${formatVnd(f.inflow)} · Chi ${formatVnd(f.outflow)}`}
          />
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Số dư đầu kỳ và đối chiếu số dư thực tế vẫn chốt ở tab Sổ quỹ của từng
        file. Ở đây chỉ hiện tiền phát sinh trong kỳ đang lọc.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thu – chi theo nhóm</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số dòng</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.group}>
                    <TableCell className="font-medium">{g.group}</TableCell>
                    <TableCell>{g.kind}</TableCell>
                    <TableCell className="text-right">{g.rows}</TableCell>
                    <TableCell
                      className={
                        g.kind === "Chi"
                          ? "text-right text-destructive"
                          : "text-right"
                      }
                    >
                      {formatVnd(g.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MPOS đang chờ tiền về ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày bán</TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Nơi</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Số ngày chờ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.code}
                    </TableCell>
                    <TableCell>
                      {p.branch} {p.line}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(p.amount)}
                    </TableCell>
                    <TableCell
                      className={
                        p.waitingDays >= 3
                          ? "text-right font-semibold text-destructive"
                          : "text-right"
                      }
                    >
                      {p.waitingDays}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chi phí & thu khác ({entries.length} dòng)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Mã CT</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead>Diễn giải</TableHead>
                <TableHead>Quỹ</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Kiểm tra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.slice(0, 200).map((e) => (
                <TableRow key={e.key}>
                  <TableCell>{formatDate(e.date)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.voucher}
                  </TableCell>
                  <TableCell>{e.kind}</TableCell>
                  <TableCell>{e.group}</TableCell>
                  <TableCell className="max-w-72">
                    <span className="line-clamp-1" title={e.description}>
                      {e.description}
                    </span>
                  </TableCell>
                  <TableCell>
                    {e.fund}
                    {e.targetFund ? ` → ${e.targetFund}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(e.amount)}
                  </TableCell>
                  <TableCell>
                    <CheckBadge check={e.check} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
