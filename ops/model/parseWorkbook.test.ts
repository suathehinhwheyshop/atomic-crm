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
import {
  applyCatalog,
  createMatcher,
  parseCatalog,
  unmatchedNames,
} from "./catalog";
import {
  channelsByUnit,
  debtPeriods,
  fundPeriods,
  pendingMoney,
} from "./finance";
import { KEY_LINES, activeMonths, keyLineValue } from "./accounting";
import { periodOf } from "./period";
import { supplierBalances, supplierFromDescription } from "./supplierLedger";
import {
  branchUnits,
  financialStatement,
  fundLatestByUnit,
  fundSeries,
  costOfGoods,
  matrixTotal,
  revenueMatrix,
} from "./reports";
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
          [
            "Mã đơn (nhập)",
            "Ngày tiền về BIDV (nhập)",
            "Kết quả (tự động)",
            "Phí POS (nhập)",
            "Ngày bán",
            "Nguồn",
            "Mã đơn",
            "Số tiền MPOS",
            "Số ngày chờ",
          ],
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

describe("Sổ quỹ, Tồn kho and Công nợ tabs", () => {
  it("reads daily closing balances and the summary block from the Sổ quỹ tab", () => {
    const { cashbook, fundSummaries } = parseWorkbook(
      source({
        "Sổ quỹ HCT": [
          ["SỔ QUỸ"],
          [],
          [
            "Từ ngày",
            "01/10/2026",
            "Đến ngày",
            "27/10/2026",
            "",
            "Chốt thực tế ngày",
            "27/10/2026",
          ],
          [],
          [
            "Quỹ",
            "Số dư đầu (nhập tay)",
            "Số dư đầu kỳ",
            "Tổng thu",
            "Tổng chi",
            "Số dư cuối kỳ",
            "Số dư thực tế",
            "Chênh lệch",
            "Số dư sổ tại ngày chốt",
          ],
          [
            "Tiền mặt",
            "0",
            "0",
            "107.076.000",
            "4.646.000",
            "102.430.000",
            "102.000.000",
            "430.000",
            "102.430.000",
          ],
          [
            "BIDV (gồm MPOS)",
            "274.354.847",
            "274.354.847",
            "",
            "",
            "155.565.510",
            "",
            "",
            "155.565.510",
          ],
          ["Tổng"],
          [],
          [],
          [
            "Ngày",
            "Loại",
            "Nguồn",
            "Mã đơn / Mã CT",
            "Nhóm",
            "Diễn giải",
            "Quỹ",
            "Thu tiền mặt",
            "Chi tiền mặt",
            "Tồn tiền mặt",
            "Thu BIDV",
            "Chi BIDV",
            "Tồn BIDV",
            "MPOS chờ về (chưa vào BIDV)",
            "Tồn MPOS chờ về",
          ],
          [
            "01/10/2026",
            "Thu",
            "Bảng Chi phí",
            "CP-0001",
            "NT HN",
            "Thu",
            "Tiền mặt",
            "590.000",
            "",
            "590.000",
            "",
            "",
            "274.354.847",
          ],
          [
            "01/10/2026",
            "Thu",
            "Bảng Chi phí",
            "CP-0002",
            "NT HN",
            "Thu",
            "Tiền mặt",
            "1.120.000",
            "",
            "1.710.000",
            "",
            "",
            "274.354.847",
          ],
          [
            "02/10/2026",
            "Thu",
            "Đơn CH",
            "SON1",
            "BÁN HÀNG",
            "MPOS",
            "MPOS chờ về",
            "",
            "",
            "1.710.000",
            "",
            "",
            "274.354.847",
            "420.000",
            "420.000",
          ],
        ],
      }),
    );

    expect(cashbook).toEqual([
      expect.objectContaining({
        date: "2026-10-01",
        cashBalance: 1_710_000,
        bankBalance: 274_354_847,
        pendingCardBalance: 0,
      }),
      expect.objectContaining({
        date: "2026-10-02",
        cashBalance: 1_710_000,
        pendingCardBalance: 420_000,
      }),
    ]);
    expect(fundSummaries).toEqual([
      expect.objectContaining({
        fund: "cash",
        opening: 0,
        closing: 102_430_000,
        actual: 102_000_000,
        closingDate: "2026-10-27",
      }),
      expect.objectContaining({
        fund: "bank",
        opening: 274_354_847,
        actual: null,
      }),
    ]);
  });

  it("reads the proposed inventory tab and the supplier ledger", () => {
    const { inventory, supplierLedger } = parseWorkbook(
      source({
        "Tồn kho": [
          ["TỒN KHO"],
          [],
          ["Ngày", "Mã SP", "Sản phẩm", "Tồn", "Tồn tối thiểu"],
          ["31/10/2026", "WHEY-ISO-2", "Whey", "12", "5"],
        ],
        "Công nợ NCC": [
          ["CÔNG NỢ"],
          [
            "Ngày",
            "Nhà cung cấp",
            "Loại",
            "Số phiếu",
            "Diễn giải",
            "Số tiền",
            "Hạn thanh toán",
            "Ghi chú",
          ],
          [
            "01/09/2026",
            "NCC A",
            "Nợ đầu kỳ",
            "",
            "",
            "10.000.000",
            "15/09/2026",
            "",
          ],
          [
            "05/10/2026",
            "NCC A",
            "Nhập hàng",
            "PN1",
            "Nhập tháng 10",
            "5.000.000",
            "04/11/2026",
            "",
          ],
          [
            "20/10/2026",
            "NCC A",
            "Trả tiền",
            "CP-9",
            "CK",
            "8.000.000",
            "",
            "",
          ],
          ["20/10/2026", "NCC A", "Sai loại", "", "", "1.000", "", ""],
        ],
        "Bảng Chi phí": [
          ["BẢNG CHI PHÍ"],
          [
            "Ngày",
            "Loại",
            "Nhóm",
            "Diễn giải",
            "Số tiền",
            "Quỹ",
            "Quỹ nhận",
            "Kiểm tra",
            "Người chi",
            "Chứng từ",
            "Ghi chú",
            "Mã CT",
          ],
          [
            "20/10/2026",
            "Chi",
            "CÔNG NỢ NCC",
            "Trả tiền hàng NCC A tháng 10",
            "8.000.000",
            "BIDV",
            "",
            "OK",
            "KT",
            "",
            "",
            "CP-0009",
          ],
          [
            "21/10/2026",
            "Chi",
            "CÔNG NỢ NCC",
            "Thanh toán NCC B",
            "1.000.000",
            "BIDV",
            "",
            "Thiếu Quỹ",
            "KT",
            "",
            "",
            "CP-0010",
          ],
        ],
      }),
    );

    expect(inventory[0]).toMatchObject({
      productCode: "WHEY-ISO-2",
      product: "Whey",
      quantity: 12,
      minimum: 5,
      updatedAt: "2026-10-31",
    });
    // Payments come from Bảng Chi phí only (the tab's "Trả tiền" row is ignored).
    expect(supplierLedger.map((e) => [e.kind, e.supplier, e.amount])).toEqual([
      ["opening", "NCC A", 10_000_000],
      ["purchase", "NCC A", 5_000_000],
      ["payment", "NCC A", 8_000_000],
    ]);
  });
});

describe("supplier name from Bảng Chi phí description", () => {
  it("strips payment verbs and trailing period words", () => {
    expect(supplierFromDescription("Trả tiền hàng NCC A tháng 10")).toBe(
      "NCC A",
    );
    expect(supplierFromDescription("Thanh toán Ostrovit đợt 2")).toBe(
      "Ostrovit",
    );
    expect(supplierFromDescription("CK Labrada 15/10")).toBe("Labrada");
    expect(supplierFromDescription("")).toBe("(không ghi tên NCC)");
  });
});

describe("supplier balances", () => {
  it("allocates payments to the oldest debt and ages the rest by due date", () => {
    const entry = (
      date: string,
      kind: "opening" | "purchase" | "payment",
      amount: number,
      dueDate = "",
    ) => ({
      key: `${date}-${kind}`,
      branch: "HN" as const,
      line: "HCT" as const,
      date,
      supplier: "NCC A",
      kind,
      ref: "",
      description: "",
      amount,
      dueDate,
      note: "",
    });

    const [balance] = supplierBalances(
      [
        entry("2026-09-01", "opening", 10_000_000, "2026-09-15"),
        entry("2026-10-05", "purchase", 5_000_000, "2026-10-20"),
        entry("2026-10-06", "purchase", 4_000_000, "2026-11-30"),
        entry("2026-10-20", "payment", 12_000_000),
      ],
      "2026-10-31",
    );

    expect(balance).toMatchObject({
      balance: 7_000_000,
      paid: 12_000_000,
      overdue30: 3_000_000,
      overdue90: 0,
      notDue: 4_000_000,
      nextDue: "2026-10-20",
    });
  });
});

describe("product catalog", () => {
  const catalog = parseCatalog([
    ["DANH MỤC"],
    [
      "Ngày",
      "Mã SP",
      "Tên chuẩn",
      "Thương hiệu",
      "Nhóm",
      "Quy cách",
      "Đơn vị",
      "Giá vốn",
      "Tên khác",
    ],
    [
      "01/09/2026",
      "WHEY-ISO-2",
      "Whey Isolate 2kg",
      "BioX",
      "Whey",
      "2kg",
      "hộp",
      "1.650.000",
      "WHEY ISO 2KG; whey isolate 4lbs",
    ],
    [
      "01/09/2026",
      "SHAKER",
      "Bình lắc",
      "",
      "Phụ kiện",
      "",
      "cái",
      "30.000",
      "bình",
    ],
  ]);
  const match = createMatcher(catalog);

  it("matches exact names, aliases and names that contain an alias", () => {
    expect(match("whey isolate 2kg")?.code).toBe("WHEY-ISO-2");
    expect(match("WHEY ISO 2KG")?.code).toBe("WHEY-ISO-2");
    expect(match("BioX Whey Isolate 4Lbs (1.8 kg) SÔ CÔ LA")?.code).toBe(
      "WHEY-ISO-2",
    );
    expect(match("Bình Lắc Shaker Ostrovit 600ml")?.code).toBe("SHAKER");
  });

  it("does not let a short alias match unrelated names", () => {
    expect(match("Yến mạch bình dân 4.5kg")).toBeNull();
    expect(match("Creatine 300g")).toBeNull();
  });

  it("annotates order items and reports names that are still unmatched", () => {
    const data = applyCatalog({
      ...mergeDatasets([]),
      catalog,
      orders: [
        {
          ...demoOrder,
          items: [
            {
              product: "WHEY ISO 2KG",
              quantity: 2,
              unitPrice: 2_000_000,
              discount: 0,
            },
            {
              product: "Creatine 300g",
              quantity: 1,
              unitPrice: 400_000,
              discount: 0,
            },
          ],
        },
      ],
    });

    expect(data.orders[0].items[0]).toMatchObject({
      productCode: "WHEY-ISO-2",
      canonicalName: "Whey Isolate 2kg",
      costPrice: 1_650_000,
    });
    expect(unmatchedNames(data.orders)).toEqual([
      expect.objectContaining({
        name: "Creatine 300g",
        quantity: 1,
        branches: ["HN"],
      }),
    ]);
    expect(costOfGoods(data.orders)).toEqual({
      cost: 3_300_000,
      coverage: 2 / 3,
    });
  });
});

const demoOrder = {
  key: "k",
  branch: "HN" as const,
  line: "HCT" as const,
  channel: "store" as const,
  date: "2026-10-01",
  shift: "Sáng",
  staff: "A",
  code: "X1",
  source: "",
  customer: "",
  phone: "",
  address: "",
  items: [],
  total: 0,
  shippingFee: 0,
  paymentMethod: "",
  paymentStatus: "",
  deliveryStatus: "Đã giao",
  postType: "",
  cash: 0,
  bank: 0,
  card: 0,
  cod: 0,
  check: "OK",
  inCashbook: true,
  revenue: 4_400_000,
};

describe("branch reports on demo workbooks", () => {
  const data = mergeDatasets(demoWorkbooks().map(parseWorkbook));
  const units = branchUnits(data);

  it("lists the six branch units in display order", () => {
    expect(units.map((u) => u.key)).toEqual([
      "HN-HCT",
      "HN-HXT",
      "HCM-HCT",
      "HCM-HXT",
      "VINH-GOP",
      "DN-GOP",
    ]);
  });

  it("monthly revenue matrix sums to the overall revenue", () => {
    const matrix = revenueMatrix(data, units, "month");

    expect(matrix.periods.map((p) => p.key)).toEqual(["2026-09", "2026-10"]);
    expect(matrixTotal(matrix)).toBe(computeKpis(data).revenue);
  });

  it("statement revenue per unit matches the revenue matrix column", () => {
    const matrix = revenueMatrix(data, units, "month");
    financialStatement(data, units).forEach((row) => {
      expect(row.revenue).toBe(matrixTotal(matrix, undefined, row.unit.key));
      expect(row.operatingResult).toBe(
        row.revenue - row.costOfGoods - row.expenses,
      );
    });
  });

  it("fund series ends at the sum of each unit's last balance", () => {
    const series = fundSeries(data.cashbook);
    const latest = fundLatestByUnit(data.cashbook, units);

    expect(series.at(-1)?.total).toBe(
      latest.reduce((t, r) => t + r.cashBalance + r.bankBalance, 0),
    );
  });

  it("week periods label the ISO week and its Monday–Sunday range", () => {
    expect(periodOf("2026-10-21", "week")).toEqual({
      key: "2026-W43",
      label: "T43 · 19/10–25/10",
      start: "2026-10-19",
    });
  });
});

describe("finance period summaries", () => {
  const data = applyCatalog(mergeDatasets(demoWorkbooks().map(parseWorkbook)));
  const units = branchUnits(data);

  it("fund opening + inflow − outflow equals closing for every unit and fund", () => {
    fundPeriods(data, units, "2026-10-01", "2026-10-31").forEach((p) => {
      expect(p.opening + p.inflow - p.outflow).toBeCloseTo(p.closing, 0);
    });
  });

  it("fund opening of October equals the closing of September", () => {
    const sept = fundPeriods(data, units, "2026-09-01", "2026-09-30");
    const oct = fundPeriods(data, units, "2026-10-01", "2026-10-31");
    oct.forEach((p) => {
      const previous = sept.find(
        (s) => s.unit.key === p.unit.key && s.fund === p.fund,
      );
      expect(p.opening).toBe(previous?.closing);
    });
  });

  it("debt opening + purchased − paid equals closing", () => {
    debtPeriods(data, units, "2026-10-01", "2026-10-31", "2026-10-31").forEach(
      (d) => {
        expect(d.opening + d.purchased - d.paid).toBeCloseTo(d.closing, 0);
        expect(d.overdue).toBeLessThanOrEqual(d.closing);
      },
    );
  });

  it("channel revenue per unit sums to the unit revenue", () => {
    const statement = financialStatement(data, units);
    channelsByUnit(data, units).forEach((row) => {
      expect(row.total).toBe(
        statement.find((s) => s.unit.key === row.unit.key)?.revenue,
      );
    });
  });

  it("pending money never goes negative", () => {
    pendingMoney(data, units).forEach((p) => {
      Object.entries(p)
        .filter(([k]) => k !== "unit")
        .forEach(([, v]) => expect(v as number).toBeGreaterThanOrEqual(0));
    });
  });
});

describe("BCTC and Kho workbooks", () => {
  const bctc = (tabs: Record<string, string[][]>): WorkbookSource => ({
    branch: "HN",
    line: "HCT",
    kind: "bctc",
    tabs,
  });

  it("reads the monthly P&L with sections, numbered lines and totals", () => {
    const { pnl } = parseWorkbook(
      bctc({
        "BCTC tháng": [
          ["BÁO CÁO TÀI CHÍNH THÁNG"],
          ["Tự tính"],
          [
            "Khoản mục",
            "Tháng 1",
            "Tháng 2",
            "Tháng 3",
            "Tháng 4",
            "Tháng 5",
            "Tháng 6",
            "Tháng 7",
            "Tháng 8",
            "Tháng 9",
            "Tháng 10",
            "Tháng 11",
            "Tháng 12",
            "Tổng 12 tháng",
            "TB",
            "Ghi chú",
          ],
          [],
          ["I. CỬA HÀNG 336 – HÀNG CÔNG TY (Sapo)"],
          [
            "1. DOANH THU",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "118.448.000",
            "115.704.000",
            "0",
            "234.152.000",
            "117.076.000",
          ],
          [
            "Cửa hàng",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "60.864.000",
            "21.892.000",
            "0",
            "82.756.000",
            "41.378.000",
          ],
          ["% LN trước CP / DT", "", "", "", "", "", "", "", "", "", "100,0%"],
          ["IV. TỔNG HỢP HCT (cửa hàng + sàn)"],
          [
            "LỢI NHUẬN SAU CHI PHÍ",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "134.500.891",
            "66.267.519",
            "0",
            "200.768.410",
            "100.384.205",
          ],
          ["Trạng thái số liệu", "x"],
        ],
      }),
    );

    expect(
      pnl.map((l) => [
        l.section.slice(0, 3),
        l.label,
        l.months[9],
        l.total,
        l.emphasis,
      ]),
    ).toEqual([
      ["I. ", "1. DOANH THU", 118_448_000, 234_152_000, true],
      ["I. ", "Cửa hàng", 60_864_000, 82_756_000, false],
      ["IV.", "LỢI NHUẬN SAU CHI PHÍ", 134_500_891, 200_768_410, true],
    ]);
    expect(keyLineValue(pnl, KEY_LINES[4], 11)).toBe(66_267_519);
    expect(activeMonths(pnl)).toEqual([10, 11]);
  });

  it("reads daily books with cost per channel (HN and Da Nang headers)", () => {
    const hn = parseWorkbook(
      bctc({
        "DT ngày": [
          ["DT"],
          ["note"],
          [],
          [
            "Ngày",
            "Tháng (tự tính)",
            "DT Cửa hàng",
            "DT Nội thành",
            "DT Bưu điện (tự lấy từ Đối soát BĐ)",
            "Cước phí BĐ",
            "GV Cửa hàng",
            "GV Nội thành",
            "GV Bưu điện",
            "Tiktok",
            "Phí Tiktok",
            "Shopee",
            "Phí Shopee",
            "Shopee 2",
            "Phí Shopee 2",
            "Tổng DT",
            "CH theo file bán hàng",
            "NT theo file bán hàng",
            "Lệch CH",
            "Lệch NT",
            "Kiểm tra (tự tính)",
          ],
          [
            "01/11/2026",
            "11",
            "10.370.000",
            "2.900.000",
            "0",
            "0",
            "8.312.500",
            "2.232.201",
            "",
            "8.424.993",
            "3.160.988",
            "0",
            "0",
            "0",
            "0",
            "21.694.993",
            "10.370.000",
            "2.900.000",
            "0",
            "0",
            "OK",
          ],
        ],
      }),
    );
    const dn = parseWorkbook({
      branch: "DN",
      line: "GOP",
      kind: "bctc",
      tabs: {
        "Doanh thu ngày": [
          ["DT"],
          ["note"],
          ["", "", "NHẬP THEO SAPO"],
          [
            "Ngày (tự động)",
            "Tháng (tự tính)",
            "Doanh thu Cửa hàng (Sapo)",
            "Doanh thu Nội thành (Sapo)",
            "Doanh thu Bưu điện (Sapo)",
            "Giá vốn Cửa hàng",
            "Giá vốn Nội thành",
            "Giá vốn Bưu điện",
            "Cửa hàng theo file bán hàng (tự lấy)",
            "Nội thành theo file bán hàng (tự lấy)",
            "Bưu điện theo file bán hàng (tự lấy)",
            "Doanh thu Cửa hàng dùng cho báo cáo",
            "Doanh thu Nội thành dùng cho báo cáo",
            "Doanh thu Bưu điện dùng cho báo cáo",
            "Tổng doanh thu (tự tính)",
            "Tổng giá vốn (tự tính)",
            "Lệch Cửa hàng",
            "Lệch Nội thành",
            "Lệch Bưu điện",
            "Kiểm tra (tự tính)",
            "Ghi chú",
          ],
          [
            "01/11/2026",
            "11",
            "11.060.000",
            "4.667.000",
            "",
            "7.749.621",
            "3.553.956",
            "",
            "11.060.000",
            "-",
            "-",
            "11.060.000",
            "4.667.000",
            "-",
            "15.727.000",
            "11.303.577",
            "-",
            "4.667.000",
            "",
            "Lệch Nội thành",
          ],
        ],
      },
    });

    expect(hn.dailyBooks[0]).toMatchObject({
      date: "2026-11-01",
      revenueStore: 10_370_000,
      revenueLocal: 2_900_000,
      costStore: 8_312_500,
      costLocal: 2_232_201,
      costPost: 0,
    });
    expect(dn.dailyBooks[0]).toMatchObject({
      date: "2026-11-01",
      revenueStore: 11_060_000,
      revenueLocal: 4_667_000,
      costStore: 7_749_621,
      costLocal: 3_553_956,
    });
  });

  it("reads the BCTC supplier ledger and the payment schedule, and drops Bảng Chi phí payments for that unit", () => {
    const sales = parseWorkbook(
      source({
        "Bảng Chi phí": [
          ["BẢNG CHI PHÍ"],
          [
            "Ngày",
            "Loại",
            "Nhóm",
            "Diễn giải",
            "Số tiền",
            "Quỹ",
            "Quỹ nhận",
            "Kiểm tra",
            "Người chi",
            "Chứng từ",
            "Ghi chú",
            "Mã CT",
          ],
          [
            "20/10/2026",
            "Chi",
            "CÔNG NỢ NCC",
            "Trả tiền hàng NCC A",
            "8.000.000",
            "BIDV",
            "",
            "OK",
            "KT",
            "",
            "",
            "CP-0009",
          ],
        ],
      }),
    );
    const accounting = parseWorkbook(
      bctc({
        "Công nợ NCC": [
          ["CÔNG NỢ"],
          ["note"],
          ["", "", "", "", "", "", "", "", "", "", "", "TỔNG HỢP THEO NCC"],
          [
            "Ngày",
            "NCC",
            "Chi nhánh",
            "Diễn giải",
            "Nhập hàng",
            "Đã trả",
            "Quỹ trả",
            "Còn nợ lũy kế (tự tính)",
            "Kiểm tra (tự tính)",
            "Ghi chú",
            "",
            "NCC",
            "Tổng nhập",
            "Đã trả",
            "Còn nợ",
          ],
          [
            "27/10/2026",
            "NCC Yến (demo)",
            "HN",
            "Số dư đầu kỳ (nợ chuyển từ sổ T10)",
            "8.400.000",
            "",
            "",
            "8.400.000",
            "OK",
            "",
            "",
            "NCC M (demo)",
            "0",
            "0",
            "0",
          ],
          [
            "02/11/2026",
            "NCC Yến (demo)",
            "HN",
            "Nhập yến mạch",
            "3.000.000",
            "",
            "",
            "11.400.000",
            "OK",
          ],
          [
            "05/11/2026",
            "NCC Yến (demo)",
            "HN",
            "CK trả",
            "",
            "5.000.000",
            "BIDV",
            "6.400.000",
            "OK",
          ],
        ],
        "Tóm tắt công nợ": [
          ["TÓM TẮT"],
          ["note"],
          [],
          ["TỔNG CÒN NỢ", "8.400.000"],
          [],
          [
            "Nhà cung cấp",
            "Tổng nhập hàng",
            "Đã trả",
            "Còn nợ",
            "Trạng thái",
            "Nhập gần nhất",
            "Trả gần nhất",
            "Công ty",
            "Ngân hàng",
          ],
          [
            "NCC Yến (demo)",
            "8.400.000",
            "0",
            "8.400.000",
            "CÒN NỢ",
            "27/10/2026",
            "",
            "Công ty TNHH Y (demo)",
            "Ngân hàng Y (demo)",
          ],
          ["TỔNG", "8.400.000"],
        ],
        "Lịch TT NCC": [
          ["LỊCH"],
          ["note"],
          [],
          [
            "Ngày",
            "NCC",
            "Chi nhánh / diễn giải",
            "Công nợ",
            "Đã thanh toán",
            "Còn thiếu (tự tính)",
            "Phương thức",
            "Ghi chú",
            "Kiểm tra (tự tính)",
          ],
          [
            "06/10/2026",
            "NCC S (demo)",
            "HCM",
            "3.888.000",
            "",
            "3.888.000",
            "BIDV",
          ],
        ],
      }),
    );
    const merged = mergeDatasets([sales, accounting]);

    expect(accounting.supplierLedger.map((e) => [e.kind, e.amount])).toEqual([
      ["opening", 8_400_000],
      ["purchase", 3_000_000],
      ["payment", 5_000_000],
    ]);
    expect(merged.supplierLedger.some((e) => e.note === "Bảng Chi phí")).toBe(
      false,
    );
    expect(
      supplierBalances(merged.supplierLedger, "2026-11-10")[0],
    ).toMatchObject({ supplier: "NCC Yến (demo)", balance: 6_400_000 });
    expect(accounting.supplierInfo[0]).toMatchObject({
      supplier: "NCC Yến (demo)",
      company: "Công ty TNHH Y (demo)",
      bank: "Ngân hàng Y (demo)",
    });
    expect(accounting.paymentSchedule[0]).toMatchObject({
      supplier: "NCC S (demo)",
      due: 3_888_000,
      paid: 0,
      remaining: 3_888_000,
      method: "BIDV",
    });
  });

  it("reads stock, purchase orders, receipts and the catalog of a Kho file", () => {
    const kho = parseWorkbook({
      branch: "HN",
      line: "GOP",
      kind: "kho",
      tabs: {
        "Danh mục": [
          ["DANH MỤC"],
          ["note"],
          ["Số sản phẩm:", "46"],
          [
            "Mã SP (Sapo/Kiot)",
            "Tên sản phẩm",
            "Loại hàng",
            "NCC",
            "Đơn vị",
            "Giá nhập",
            "Tồn tối thiểu",
            "Ghi chú",
          ],
          [
            "",
            "Creatine 300g (demo)",
            "HCT",
            "NCC B (demo)",
            "Hộp",
            "200.000",
            "",
            "",
          ],
        ],
        "Hàng xách tay tồn kho": [
          ["HXT"],
          ["note"],
          ["Từ ngày"],
          [
            "Sản phẩm",
            "Tồn đầu kỳ",
            "Nhập trong kỳ",
            "Bán trong kỳ",
            "HSD gần nhất",
            "Ghi chú",
            "Chuyển chi nhánh (tự tính)",
            "Tồn cuối (tự tính)",
            "Tồn tối thiểu (tự tính)",
            "Còn hạn (ngày)",
            "Cảnh báo (tự tính)",
          ],
          [
            "Vitamin D3 K2 (demo)",
            "131",
            "",
            "",
            "",
            "",
            "0",
            "131",
            "",
            "",
            "OK",
          ],
        ],
        "Hàng công ty đã đặt": [
          ["PO"],
          ["note"],
          ["Số dòng chưa nhận đủ:", "0"],
          [
            "Ngày đặt",
            "Mã PO",
            "NCC",
            "Sản phẩm",
            "SL đặt",
            "Đơn giá nhập",
            "Ngày dự kiến về",
            "Hủy đơn",
            "Ghi chú",
            "Thành tiền (tự tính)",
            "SL đã nhận (tự tính)",
            "SL còn thiếu (tự tính)",
            "Trạng thái (tự tính)",
            "Kiểm tra (tự tính)",
          ],
          [
            "02/11/2026",
            "PON00065",
            "NCC B (demo)",
            "Omega 3 (demo)",
            "24",
            "46.328",
            "",
            "FALSE",
            "",
            "1.111.872",
            "12",
            "12",
            "Nhận một phần",
            "OK",
          ],
        ],
        "Hàng công ty mới về": [
          ["RC"],
          ["note"],
          ["Hàng cận date:", "0"],
          [
            "Ngày nhận",
            "Mã PO",
            "Sản phẩm",
            "SL nhận",
            "Hạn sử dụng",
            "Số lô",
            "Người nhận",
            "Ghi chú",
            "NCC (tự tính)",
            "Đơn giá nhập (tự tính)",
            "Thành tiền (tự tính)",
            "SL đặt (tự tính)",
            "Kiểm tra (tự tính)",
          ],
          [
            "02/11/2026",
            "PON00065",
            "Omega 3 (demo)",
            "12",
            "01/01/2029",
            "",
            "QUANG",
            "",
            "NCC B (demo)",
            "46.328",
            "555.936",
            "24",
            "OK",
          ],
        ],
      },
    });

    expect(kho.catalog[0]).toMatchObject({
      name: "Creatine 300g (demo)",
      group: "HCT",
      costPrice: 200_000,
    });
    expect(kho.stock[0]).toMatchObject({
      product: "Vitamin D3 K2 (demo)",
      opening: 131,
      closing: 131,
      warning: "OK",
    });
    expect(kho.purchaseOrders[0]).toMatchObject({
      po: "PON00065",
      ordered: 24,
      received: 12,
      missing: 12,
      cancelled: false,
    });
    expect(kho.receipts[0]).toMatchObject({
      po: "PON00065",
      quantity: 12,
      amount: 555_936,
      expiry: "2029-01-01",
    });
  });

  it("parses the Da Nang / Vinh sales tabs with their own tab and column names", () => {
    const vinh = parseWorkbook({
      branch: "VINH",
      line: "GOP",
      tabs: {
        "Đơn Tại Cửa hàng": [
          ["ĐƠN"],
          ["note"],
          [],
          [
            "Ngày",
            "Ca",
            "Nhân viên",
            "Mã đơn",
            "Khách hàng",
            "Số điện thoại",
            "Sản phẩm",
            "Số lượng",
            "Đơn giá",
            "Chiết khấu",
            "Tiền sản phẩm (tự tính)",
            "Tổng tiền khách trả",
            "Hình thức thanh toán",
            "Trạng thái thanh toán",
            "Hỗn hợp: Tiền mặt",
            "Hỗn hợp: Chuyển khoản",
            "Hỗn hợp: MPOS",
            "Tiền mặt (tự tính)",
            "Chuyển khoản ngân hàng (tự tính)",
            "MPOS (tự tính)",
            "Kiểm tra",
            "Vào Sổ quỹ",
          ],
          [
            "03/11/2026",
            "Sáng",
            "NV1",
            "SON00244",
            "Khách",
            "0900 000 244",
            "Dây kháng lực (demo)",
            "2",
            "170.000",
            "0",
            "340.000",
            "340.000",
            "Chuyển khoản MB",
            "Đã thanh toán",
            "",
            "",
            "",
            "0",
            "340.000",
            "0",
            "OK",
            "Đã vào sổ quỹ",
          ],
        ],
        "Đơn COD": [
          ["ĐƠN BƯU ĐIỆN"],
          ["note"],
          [],
          [
            "Ngày",
            "Nguồn",
            "Mã đơn",
            "Mã vận đơn",
            "Khách hàng",
            "Số điện thoại",
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
            "Trạng thái thanh toán",
            "Ngày tiền về TK",
            "Tiền thực nhận",
            "Kiểm tra",
            "Nhân viên xử lý đơn",
            "Ca (Sáng/Tối)",
          ],
          [
            "02/11/2026",
            "ZALO",
            "SON00683",
            "1562",
            "Khách",
            "0900000683",
            "Tỉnh khác (demo)",
            "Pre-workout (demo) x 1",
            "1",
            "950.000",
            "0",
            "0",
            "950.000",
            "COD (thu hộ BĐ)",
            "Mới",
            "Đã giao",
            "Chưa thanh toán",
            "",
            "",
            "",
            "NV2",
            "Sáng",
          ],
        ],
        "Chi Phí": [
          ["CHI PHÍ"],
          ["note"],
          [],
          [
            "Ngày",
            "Loại",
            "Nhóm",
            "Diễn giải",
            "Số tiền",
            "Quỹ",
            "Quỹ nhận",
            "Kiểm tra",
            "Người chi",
            "Chứng từ / link ảnh",
            "Ghi chú",
            "Mã CT",
          ],
          [
            "03/11/2026",
            "Chi",
            "SHIP NGOÀI",
            "Ship nt",
            "30.000",
            "Tiền mặt",
            "",
            "OK",
            "",
            "",
            "",
            "CP-0001",
          ],
        ],
        "Sổ quỹ": [
          ["SỔ QUỸ"],
          ["note"],
          [
            "Từ ngày",
            "01/10/2026",
            "Đến ngày",
            "03/11/2026",
            "",
            "Chốt thực tế ngày",
          ],
          [],
          [
            "Quỹ",
            "Số dư đầu (nhập tay)",
            "Số dư đầu kỳ",
            "Tổng thu",
            "Tổng chi",
            "Số dư cuối kỳ",
            "Số dư thực tế",
          ],
          ["Tiền mặt", "0", "2.300.000", "667.000", "230.000", "2.737.000", ""],
          [
            "Ngân hàng (MB + AT, gồm MPOS)",
            "0",
            "0",
            "11.990.000",
            "0",
            "11.990.000",
            "",
          ],
          ["Tổng"],
          [],
          [],
          [
            "Ngày",
            "Loại",
            "Nguồn",
            "Mã đơn / Mã CT",
            "Nhóm",
            "Diễn giải",
            "Quỹ",
            "Thu tiền mặt",
            "Chi tiền mặt",
            "Tồn tiền mặt",
            "Thu ngân hàng (MB/AT)",
            "Chi ngân hàng (MB/AT)",
            "Tồn ngân hàng (MB + AT)",
            "MPOS chờ về (chưa vào MB/AT)",
            "Tồn MPOS chờ về",
          ],
          [
            "03/11/2026",
            "Thu",
            "Đơn CH",
            "SON00244",
            "BÁN HÀNG VINH",
            "Thu",
            "MB",
            "",
            "",
            "2.300.000",
            "340.000",
            "",
            "340.000",
          ],
        ],
        "MPOS về ngân hàng": [
          ["MPOS"],
          ["note"],
          ["NHẬP KHI TIỀN VỀ"],
          [
            "Mã đơn (nhập)",
            "Ngày tiền về (nhập)",
            "Ngân hàng nhận (chọn MB hoặc AT)",
            "Kết quả (tự động)",
            "Phí POS (nhập)",
            "Ngày bán",
            "Nguồn",
            "Mã đơn",
            "Số tiền MPOS",
            "Số ngày chờ",
          ],
          [
            "",
            "",
            "",
            "",
            "",
            "01/11/2026",
            "Đơn CH",
            "SON00673",
            "1.490.000 đ",
            "3",
          ],
        ],
      },
    });

    expect(
      vinh.orders.map((o) => [
        o.channel,
        o.code,
        o.phone,
        o.items[0]?.quantity,
        o.bank,
        o.cod,
        o.revenue,
      ]),
    ).toEqual([
      ["store", "SON00244", "0900000244", 2, 340_000, 0, 340_000],
      ["post", "SON00683", "0900000683", 1, 0, 950_000, 950_000],
    ]);
    expect(vinh.cashEntries[0]).toMatchObject({
      group: "SHIP NGOÀI",
      amount: 30_000,
    });
    expect(vinh.cashbook[0]).toMatchObject({
      bankBalance: 340_000,
      bankIn: 340_000,
      cashBalance: 2_300_000,
    });
    expect(vinh.fundSummaries.map((f) => [f.fund, f.closing])).toEqual([
      ["cash", 2_737_000],
      ["bank", 11_990_000],
    ]);
    expect(vinh.pendingCards[0]).toMatchObject({
      code: "SON00673",
      amount: 1_490_000,
      waitingDays: 3,
    });
  });
});
