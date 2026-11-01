import { describe, expect, it } from "vitest";

import { demoWorkbooks } from "../data/demoWorkbooks";
import {
  buildAlerts,
  buildCustomers,
  computeKpis,
  filterDataset,
  summarizeChannels,
} from "./metrics";
import { mergeDatasets, parseWorkbook } from "./parseWorkbook";
import { parseAmount, parseDate } from "./sheet";
import type { WorkbookSource } from "./types";

// Header rows copied from the real HCT / HXT report files (titles and notes above them).
const STORE_HEADER = [
  "Ngày",
  "Ca",
  "Nhân viên",
  "Mã đơn",
  "Khách hàng",
  "SĐT",
  "Sản phẩm",
  "SL",
  "Đơn giá",
  "Chiết khấu",
  "Tiền SP (tự tính)",
  "Tổng tiền khách trả",
  "Hình thức TT",
  "Trạng thái TT",
  "Hỗn hợp: Tiền mặt",
  "Hỗn hợp: CK",
  "Hỗn hợp: MPOS",
  "Tiền mặt (tự tính)",
  "CK BIDV (tự tính)",
  "MPOS (tự tính)",
  "Kiểm tra",
  "Vào Sổ quỹ",
];
const LOCAL_HEADER = [
  "Ngày",
  "Nguồn",
  "Mã đơn",
  "Khách hàng",
  "SĐT",
  "Địa chỉ",
  "Sản phẩm",
  "SL",
  "Đơn giá",
  "Chiết khấu",
  "Phí ship thu khách",
  "Tổng tiền khách trả (cả đơn)",
  "Trạng thái giao",
  "Hình thức TT",
  "Trạng thái TT",
  "Ngày tiền về (trống = ngày đơn)",
  "Hỗn hợp: Tiền mặt",
  "Hỗn hợp: CK",
  "Hỗn hợp: MPOS",
  "Tiền mặt (tự tính)",
  "CK BIDV (tự tính)",
  "MPOS (tự tính)",
  "Kiểm tra",
  "Vào Sổ quỹ",
  "Phí ship thực tế",
  "Người giao",
  "Nhân viên thu tiền",
  "Ca (Sáng/Tối)",
];
const POST_HEADER = [
  "Ngày",
  "Nguồn",
  "Mã đơn",
  "Mã vận đơn",
  "Khách hàng",
  "SĐT",
  "Địa chỉ",
  "Sản phẩm (SL)",
  "Tổng SL",
  "Tiền hàng",
  "Chiết khấu",
  "Phí ship",
  "Tổng thu (tự tính)",
  "Hình thức thu",
  "Loại đơn",
  "Trạng thái giao",
  "Trạng thái TT",
  "Ngày tiền về TK (chỉ nhập nếu khác ngày đơn)",
  "Tiền thực nhận (chỉ nhập nếu khác Tổng thu)",
  "Kiểm tra",
  "Nhân viên xử lý đơn",
  "Ca (Sáng/Tối)",
];

const source = (tabs: Record<string, string[][]>): WorkbookSource => ({
  branch: "HN",
  line: "HCT",
  tabs,
});

describe("sheet value parsing", () => {
  it("reads Vietnamese amounts and dates", () => {
    expect(parseAmount("4.020.000")).toBe(4_020_000);
    expect(parseAmount("2.190.000 đ")).toBe(2_190_000);
    expect(parseAmount("-680.000")).toBe(-680_000);
    expect(parseAmount("")).toBe(0);
    expect(parseDate("1/10/2026")).toBe("2026-10-01");
    expect(parseDate("not a date")).toBe("");
  });
});

describe("parseWorkbook", () => {
  it("groups multi-line store orders and keeps payment split", () => {
    const tabs = {
      "Đơn CH HKD": [
        ["ĐƠN BÁN TẠI CỬA HÀNG"],
        ["note"],
        [],
        STORE_HEADER,
        [
          "21/10/2026",
          "Sáng",
          "Việt",
          "A1",
          "Khách A",
          "0900 000 001",
          "Creatine",
          "1",
          "420.000",
          "0",
          "420.000",
          "4.020.000",
          "Chuyển khoản BIDV",
          "Đã thanh toán",
          "",
          "",
          "",
          "0",
          "4.020.000",
          "0",
          "OK",
          "Đã vào sổ quỹ",
        ],
        ["", "", "", "", "", "", "Shaker", "1", "0", "0", "0"],
        ["", "", "", "", "", "", "Whey", "1", "3.600.000", "0", "3.600.000"],
        [
          "21/10/2026",
          "Sáng",
          "VIỆT",
          "A2",
          "Khách B",
          "0900000002",
          "Magnesium",
          "1",
          "300.000",
          "0",
          "300.000",
          "300.000",
          "Tiền mặt",
          "Đã thanh toán",
          "",
          "",
          "",
          "300.000",
          "0",
          "0",
          "Lệch",
          "",
        ],
      ],
    };

    const { orders } = parseWorkbook(source(tabs));

    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      code: "A1",
      staff: "VIỆT",
      phone: "0900000001",
      total: 4_020_000,
      bank: 4_020_000,
      revenue: 4_020_000,
      inCashbook: true,
      channel: "store",
    });
    expect(orders[0].items.map((i) => i.product)).toEqual([
      "Creatine",
      "Shaker",
      "Whey",
    ]);
    expect(orders[1]).toMatchObject({
      code: "A2",
      revenue: 0,
      inCashbook: false,
    });
  });

  it("counts local delivery revenue only when delivered", () => {
    const row = (code: string, status: string) => [
      "21/10/2026",
      "WEB",
      code,
      "Khách",
      "0900000003",
      "HN",
      "Whey",
      "1",
      "2.960.000",
      "30.000",
      "0",
      "2.930.000",
      status,
      "Tiền mặt",
      "Đã thanh toán",
      "",
      "",
      "",
      "",
      "2.930.000",
      "0",
      "0",
      "OK",
      "Đã vào sổ quỹ",
      "",
      "",
      "VIỆT",
      "Sáng",
    ];
    const { orders } = parseWorkbook(
      source({
        "Đơn NT HKD": [
          LOCAL_HEADER,
          row("N1", "Đã giao"),
          row("N2", "Đang giao"),
        ],
      }),
    );

    expect(orders.map((o) => [o.code, o.revenue, o.staff, o.shift])).toEqual([
      ["N1", 2_930_000, "VIỆT", "Sáng"],
      ["N2", 0, "VIỆT", "Sáng"],
    ]);
  });

  it("applies post office rules: new = total, resend = shipping only, not delivered = 0", () => {
    const row = (code: string, type: string, status: string) => [
      "27/10/2026",
      "ZALO",
      code,
      "VD1",
      "Khách",
      "0900000004",
      "Tỉnh",
      "Creatine x 1",
      "1",
      "650.000",
      "0",
      "30.000",
      "680.000",
      "COD (thu hộ BĐ)",
      type,
      status,
      "Chưa thanh toán",
      "",
      "",
      "",
      "QUANG",
      "Sáng",
    ];
    const { orders } = parseWorkbook(
      source({
        "Đơn Bưu điện": [
          POST_HEADER,
          row("P1", "Mới", "Đã giao"),
          row("P2", "Gửi lại", "Đã giao"),
          row("P3", "Mới", "Đang giao"),
        ],
      }),
    );

    expect(orders.map((o) => [o.code, o.revenue, o.cod])).toEqual([
      ["P1", 680_000, 680_000],
      ["P2", 30_000, 680_000],
      ["P3", 0, 680_000],
    ]);
  });

  it("reads pending card payments from the MPOS tab", () => {
    const { pendingCards } = parseWorkbook(
      source({
        "MPOS về BIDV": [
          ["MPOS"],
          [],
          [],
          ["Mã đơn (nhập)"],
          ["", "", "", "", "21/10/2026", "Đơn CH", "A9", "2.190.000 đ", "11"],
        ],
      }),
    );

    expect(pendingCards).toEqual([
      expect.objectContaining({
        code: "A9",
        amount: 2_190_000,
        waitingDays: 11,
        date: "2026-10-21",
      }),
    ]);
  });
});

describe("metrics on demo workbooks", () => {
  const data = mergeDatasets(demoWorkbooks().map(parseWorkbook));

  it("KPIs equal the sum of the channel table", () => {
    const channels = summarizeChannels(data);
    const kpis = computeKpis(data);

    expect(kpis.revenue).toBe(channels.reduce((t, c) => t + c.revenue, 0));
    expect(kpis.revenue).toBeGreaterThan(0);
  });

  it("filters by goods line and period", () => {
    const hxt = filterDataset(data, {
      branch: "HN",
      line: "HXT",
      from: "2026-10-10",
      to: "2026-10-12",
    });

    expect(hxt.orders.length).toBeGreaterThan(0);
    expect(
      hxt.orders.every(
        (o) =>
          o.line === "HXT" && o.date >= "2026-10-10" && o.date <= "2026-10-12",
      ),
    ).toBe(true);
  });

  it("merges a returning customer's orders by phone number", () => {
    const customers = buildCustomers(data.orders);
    const returning = customers.find((c) => c.orderCount > 1)!;

    expect(returning.orders.every((o) => o.phone === returning.phone)).toBe(
      true,
    );
    expect(new Set(customers.map((c) => c.id)).size).toBe(customers.length);
  });

  it("raises an alert for card payments waiting 3 days or more", () => {
    const alerts = buildAlerts(data, "2026-10-31");
    const waiting = data.pendingCards.filter((p) => p.waitingDays >= 3);

    expect(alerts.filter((a) => a.key.startsWith("card-"))).toHaveLength(
      waiting.length,
    );
  });
});
