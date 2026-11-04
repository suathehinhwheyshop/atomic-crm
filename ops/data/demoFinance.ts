// Demo BCTC and Kho workbooks, shaped like the real files (same tab titles and
// header rows), derived from a demo sales workbook so the numbers agree.
import { format, parseISO } from "date-fns";

import { parseWorkbook } from "../model/parseWorkbook";
import type { WorkbookSource } from "../model/types";

const vnAmount = (n: number) =>
  Math.round(n).toLocaleString("de-DE").replace(/,/g, ".");
const vnDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const titleRows = (title: string) => [
  [title],
  ["DỮ LIỆU DEMO – không phải số liệu thật"],
  [],
];

const SUPPLIERS = [
  ["NCC A (demo)", "Công ty TNHH A (demo)", "BIDV"],
  ["NCC B (demo)", "Công ty TNHH B (demo)", "Techcombank"],
  ["NCC C (demo)", "Công ty CP C (demo)", "Vietcombank"],
];

const COST_RATE = 0.68;

/** BCTC workbook for one sales workbook: monthly P&L, daily revenue with cost, supplier ledger. */
export const demoBctcFor = (sales: WorkbookSource): WorkbookSource => {
  const data = parseWorkbook(sales);
  const days = [...new Set(data.orders.map((o) => o.date))].sort();
  const byDay = (date: string, channel: string) =>
    data.orders
      .filter((o) => o.date === date && o.channel === channel && o.revenue > 0)
      .reduce((t, o) => t + o.revenue, 0);
  const dailyRows = days.map((date) => {
    const store = byDay(date, "store");
    const local = byDay(date, "local");
    const post = byDay(date, "post");
    return [
      vnDate(date),
      String(Number(date.slice(5, 7))),
      vnAmount(store),
      vnAmount(local),
      vnAmount(post),
      "0",
      vnAmount(store * COST_RATE),
      vnAmount(local * COST_RATE),
      vnAmount(post * COST_RATE),
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      vnAmount(store + local + post),
      vnAmount(store),
      vnAmount(local),
      "0",
      "0",
      "OK",
    ];
  });

  const month = (
    m: number,
    pick: (o: { date: string; revenue?: number }) => boolean,
  ) =>
    data.orders
      .filter(
        (o) => Number(o.date.slice(5, 7)) === m && o.revenue > 0 && pick(o),
      )
      .reduce((t, o) => t + o.revenue, 0);
  const platform = (m: number, channel: string) =>
    data.platformOrders.filter(
      (o) =>
        Number(o.date.slice(5, 7)) === m &&
        o.channel === channel &&
        o.check.startsWith("OK"),
    );
  const expenses = (m: number) =>
    data.cashEntries
      .filter(
        (e) =>
          Number(e.date.slice(5, 7)) === m &&
          e.kind === "Chi" &&
          !["NỘP - CHUYỂN QUỸ (CHI)", "CÔNG NỢ NCC"].includes(e.group),
      )
      .reduce((t, e) => t + e.amount, 0);
  const row = (label: string, value: (m: number) => number) => {
    const values = Array.from({ length: 12 }, (_, i) => value(i + 1));
    const total = values.reduce((t, v) => t + v, 0);
    const active = values.filter((v) => v !== 0).length;
    return [
      label,
      ...values.map(vnAmount),
      vnAmount(total),
      vnAmount(active ? total / active : 0),
    ];
  };
  const storeRevenue = (m: number) =>
    month(m, (o) => (o as { channel?: string }).channel === "store");
  const localRevenue = (m: number) =>
    month(m, (o) => (o as { channel?: string }).channel === "local");
  const postRevenue = (m: number) =>
    month(m, (o) => (o as { channel?: string }).channel === "post");
  const shopRevenue = (m: number) =>
    storeRevenue(m) + localRevenue(m) + postRevenue(m);
  const cogs = (m: number) => shopRevenue(m) * COST_RATE;
  const tiktok = (m: number) =>
    platform(m, "tiktok").reduce((t, o) => t + o.revenue, 0);
  const tiktokFee = (m: number) =>
    platform(m, "tiktok").reduce((t, o) => t + o.fee, 0);
  const shopee = (m: number) =>
    platform(m, "shopee").reduce((t, o) => t + o.revenue, 0);
  const shopeeFee = (m: number) =>
    platform(m, "shopee").reduce((t, o) => t + o.fee, 0);
  const pnl = [
    [
      "Khoản mục",
      ...Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`),
      "Tổng 12 tháng",
      "TB tháng có số liệu",
      "Ghi chú",
    ],
    [],
    ["I. CỬA HÀNG – HÀNG CÔNG TY (Sapo)"],
    row("1. DOANH THU", shopRevenue),
    row("Cửa hàng", storeRevenue),
    row("Nội thành", localRevenue),
    row("Bưu điện (thu hộ + chuyển khoản)", postRevenue),
    row("2. GIÁ VỐN", cogs),
    row("3. LỢI NHUẬN TRƯỚC CHI PHÍ", (m) => shopRevenue(m) - cogs(m)),
    row("4. CHI PHÍ", expenses),
    row(
      "5. LỢI NHUẬN SAU CHI PHÍ (cửa hàng)",
      (m) => shopRevenue(m) - cogs(m) - expenses(m),
    ),
    [],
    ["II. TIKTOK"],
    row("Doanh thu", tiktok),
    row("Phí sàn", tiktokFee),
    row("Lợi nhuận sau phí", (m) => tiktok(m) - tiktokFee(m)),
    [],
    ["III. SHOPEE (Shopee + Shopee 2)"],
    row("Doanh thu", shopee),
    row("Phí sàn", shopeeFee),
    row("Lợi nhuận sau phí", (m) => shopee(m) - shopeeFee(m)),
    [],
    ["IV. TỔNG HỢP (cửa hàng + sàn)"],
    row("Tổng doanh thu", (m) => shopRevenue(m) + tiktok(m) + shopee(m)),
    row("Tổng giá vốn", cogs),
    row(
      "Lợi nhuận trước chi phí",
      (m) => shopRevenue(m) + tiktok(m) + shopee(m) - cogs(m),
    ),
    row(
      "Tổng chi phí (chi phí chung + phí sàn)",
      (m) => expenses(m) + tiktokFee(m) + shopeeFee(m),
    ),
    row(
      "LỢI NHUẬN SAU CHI PHÍ",
      (m) =>
        shopRevenue(m) +
        tiktok(m) +
        shopee(m) -
        cogs(m) -
        expenses(m) -
        tiktokFee(m) -
        shopeeFee(m),
    ),
  ];

  // Supplier ledger: opening balance, purchases on the 3rd of each month, payments = the CÔNG NỢ NCC rows of Bảng Chi phí.
  const payments = data.cashEntries
    .filter((e) => e.group === "CÔNG NỢ NCC")
    .sort((a, b) => a.date.localeCompare(b.date));
  const months = [
    ...new Set(data.orders.map((o) => o.date.slice(0, 7))),
  ].sort();
  const ledger: string[][] = [];
  SUPPLIERS.slice(0, sales.line === "HXT" ? 2 : 3).forEach(([name], i) => {
    const opening = 15_000_000 + i * 7_000_000;
    ledger.push([
      vnDate(`${months[0]}-01`),
      name,
      sales.branch,
      "Số dư đầu kỳ (nợ chuyển sang)",
      vnAmount(opening),
      "",
      "",
      "",
      "OK",
      "",
    ]);
    months.forEach((ym, mi) => {
      const purchase = 30_000_000 + ((i + mi) % 3) * 8_000_000;
      ledger.push([
        vnDate(`${ym}-03`),
        name,
        sales.branch,
        `Nhập hàng tháng ${Number(ym.slice(5))} (demo)`,
        vnAmount(purchase),
        "",
        "",
        "",
        "OK",
        "",
      ]);
    });
  });
  payments.forEach((p, i) => {
    const supplier = SUPPLIERS[i % (sales.line === "HXT" ? 2 : 3)][0];
    ledger.push([
      vnDate(p.date),
      supplier,
      sales.branch,
      p.description,
      "",
      vnAmount(p.amount),
      p.fund,
      "",
      "OK",
      "",
    ]);
  });
  ledger.sort((a, b) =>
    a[0]
      .split("/")
      .reverse()
      .join("-")
      .localeCompare(b[0].split("/").reverse().join("-")),
  );

  const summary = SUPPLIERS.map(([name, company, bank]) => [
    name,
    "",
    "",
    "",
    "",
    "",
    "",
    company,
    bank,
  ]);
  const schedule =
    sales.line === "HCT"
      ? [
          [
            vnDate(`${months.at(-1)}-06`),
            SUPPLIERS[0][0],
            sales.branch,
            vnAmount(42_000_000),
            vnAmount(42_000_000),
            "0",
            "BIDV",
            "",
            "OK",
          ],
          [
            vnDate(`${months.at(-1)}-06`),
            SUPPLIERS[1][0],
            sales.branch,
            vnAmount(18_500_000),
            "",
            vnAmount(18_500_000),
            "BIDV",
            "",
            "OK",
          ],
          [
            vnDate(`${months.at(-1)}-13`),
            SUPPLIERS[2][0],
            sales.branch,
            vnAmount(27_300_000),
            vnAmount(10_000_000),
            vnAmount(17_300_000),
            "BIDV",
            "",
            "OK",
          ],
        ]
      : [];

  return {
    branch: sales.branch,
    line: sales.line,
    kind: "bctc",
    tabs: {
      "BCTC tháng": [
        ["BÁO CÁO TÀI CHÍNH THÁNG (demo)"],
        ["Tự tính từ các tab, không nhập tay."],
        ...pnl,
      ],
      "DT ngày": [
        ...titleRows("DT ngày"),
        [
          "Ngày",
          "Tháng (tự tính)",
          "DT Cửa hàng",
          "DT Nội thành",
          "DT Bưu điện",
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
          "Kiểm tra",
        ],
        ...dailyRows,
      ],
      "Công nợ NCC": [
        ...titleRows("Công nợ NCC"),
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
        ],
        ...ledger,
      ],
      "Tóm tắt công nợ": [
        ["TÓM TẮT CÔNG NỢ (demo)"],
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
        ...summary,
      ],
      ...(schedule.length
        ? {
            "Lịch TT NCC": [
              ["LỊCH THANH TOÁN NCC (demo)"],
              [],
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
              ...schedule,
            ],
          }
        : {}),
    },
  };
};

const HXT_PRODUCTS = [
  "Whey xách tay 2.2kg (demo)",
  "Pre-workout xách tay (demo)",
  "Omega 3 xách tay (demo)",
  "BCAA xách tay (demo)",
  "Vitamin D3 K2 xách tay (demo)",
];
const HCT_PRODUCTS = [
  "Whey Isolate 2kg (demo)",
  "Creatine Monohydrate 300g (demo)",
  "Mass Gainer 5.4kg (demo)",
  "Vitamin tổng hợp 100 viên (demo)",
];

/** Kho workbook for one branch (HN, HCM). */
export const demoKhoFor = (
  branch: "HN" | "HCM",
  seed: number,
): WorkbookSource => {
  const r = (i: number) => ((seed * 31 + i * 17) % 50) + 5;
  const stock = HXT_PRODUCTS.map((p, i) => {
    const opening = r(i) * 2;
    const received = i % 2 ? 20 : 0;
    const sold = r(i + 3);
    const transferred = i === 1 ? 6 : 0;
    const closing = Math.max(0, opening + received - sold - transferred);
    return [
      p,
      String(opening),
      String(received),
      String(sold),
      i === 2 ? "15/12/2026" : "",
      "",
      String(transferred),
      String(closing),
      "8",
      i === 2 ? "41" : "",
      closing === 0
        ? "Hết hàng"
        : closing <= 8
          ? "Sắp hết"
          : i === 2
            ? "Cận hạn"
            : "OK",
    ];
  });
  const orders = HCT_PRODUCTS.map((p, i) => {
    const ordered = 24;
    const received = i < 2 ? 24 : i === 2 ? 12 : 0;
    return [
      "02/11/2026",
      `PON0006${seed}`,
      "NCC A (demo)",
      p,
      String(ordered),
      vnAmount(300_000 + i * 150_000),
      i === 3 ? "01/11/2026" : "09/11/2026",
      "",
      "",
      vnAmount(ordered * (300_000 + i * 150_000)),
      String(received),
      String(ordered - received),
      received === ordered
        ? "Đã nhận đủ"
        : received
          ? "Nhận một phần"
          : "Chưa về",
      "OK",
      "",
    ];
  });
  const receipts = HCT_PRODUCTS.slice(0, 3).map((p, i) => [
    "02/11/2026",
    `PON0006${seed}`,
    p,
    String(i === 2 ? 12 : 24),
    "01/01/2029",
    "",
    "QUANG",
    "",
    "NCC A (demo)",
    vnAmount(300_000 + i * 150_000),
    vnAmount((i === 2 ? 12 : 24) * (300_000 + i * 150_000)),
    "24",
    "OK",
    "",
  ]);
  const catalog = [
    ...HCT_PRODUCTS.map((p, i) => [
      "",
      p,
      "HCT",
      "NCC A (demo)",
      "Hộp",
      vnAmount(300_000 + i * 150_000),
      "5",
      "",
    ]),
    ...HXT_PRODUCTS.map((p, i) => [
      "",
      p,
      "HXT",
      "NCC B (demo)",
      "Hộp",
      vnAmount(250_000 + i * 120_000),
      "8",
      "",
    ]),
  ];
  return {
    branch,
    line: "GOP",
    kind: "kho",
    tabs: {
      "Danh mục": [
        ["DANH MỤC CỐ ĐỊNH – FILE HÀNG HOÁ (demo)"],
        [],
        [],
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
        ...catalog,
      ],
      "Hàng xách tay tồn kho": [
        ["HÀNG XÁCH TAY TỒN KHO (demo)"],
        [],
        [],
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
        ...stock,
      ],
      "Hàng công ty đã đặt": [
        ["HÀNG CÔNG TY ĐÃ ĐẶT (demo)"],
        [],
        [],
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
          "Khoá PO|SP (tự tính)",
        ],
        ...orders,
      ],
      "Hàng công ty mới về": [
        ["HÀNG CÔNG TY MỚI VỀ (demo)"],
        [],
        [],
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
          "Khoá PO|SP (tự tính)",
        ],
        ...receipts,
      ],
    },
  };
};
