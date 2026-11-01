import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cellKey, matrixTotal, type Matrix } from "../model/reports";
import { UnitLabel } from "./UnitLabel";

/** Periods as rows, branch units as columns, totals on both axes. */
export const MatrixTable = ({
  matrix,
  format,
  firstColumn = "Kỳ",
  emphasizeTotal = true,
}: {
  matrix: Matrix;
  format: (value: number) => string;
  firstColumn?: string;
  emphasizeTotal?: boolean;
}) => {
  if (!matrix.periods.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Không có dữ liệu trong kỳ này.
      </p>
    );
  }
  const periods = [...matrix.periods].reverse();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{firstColumn}</TableHead>
          {matrix.units.map((u) => (
            <TableHead key={u.key} className="text-right">
              <UnitLabel unit={u} />
            </TableHead>
          ))}
          <TableHead className="text-right">Tổng</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {periods.map((p) => (
          <TableRow key={p.key}>
            <TableCell className="font-medium whitespace-nowrap">
              {p.label}
            </TableCell>
            {matrix.units.map((u) => {
              const v = matrix.values.get(cellKey(p.key, u.key)) ?? 0;
              return (
                <TableCell
                  key={u.key}
                  className={
                    v ? "text-right" : "text-right text-muted-foreground"
                  }
                >
                  {v ? format(v) : "–"}
                </TableCell>
              );
            })}
            <TableCell
              className={
                emphasizeTotal ? "text-right font-semibold" : "text-right"
              }
            >
              {format(matrixTotal(matrix, p.key))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Tổng kỳ</TableCell>
          {matrix.units.map((u) => (
            <TableCell key={u.key} className="text-right">
              {format(matrixTotal(matrix, undefined, u.key))}
            </TableCell>
          ))}
          <TableCell className="text-right">
            {format(matrixTotal(matrix))}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
};
