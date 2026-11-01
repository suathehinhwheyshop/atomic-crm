// Anonymized demo data shaped exactly like the real report spreadsheets
// (same tab titles, header rows and Vietnamese formats), so the same parser runs
// on demo and live data. No real customer, supplier or figure appears here.
import { addDays, format, parseISO } from "date-fns";

import type { BranchCode, GoodsLine, WorkbookSource } from "../model/types";
import {
  EXPENSE_HEADER,
  LOCAL_HEADER,
  PLATFORM_HEADER,
  POST_HEADER,
  STORE_HEADER,
  cashbookHeader,
  catalogHeader,
  inventoryHeader,
  ledgerHeader,
} from "./demoHeaders";

const createRandom = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};

const vnAmount = (n: number) =>
  Math.round(n).toLocaleString("de-DE").replace(/,/g, ".");
const vnDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

// code, canonical name, sale price, cost price, alternative spellings used by other branches
type DemoProduct = [string, string, number, number, string[]];
const PRODUCTS: Record<"HCT" | "HXT", DemoProduct[]> = {
  HCT: [
    [
      "WHEY-ISO-2",
      "Whey Isolate 2kg (demo)",
      2_200_000,
      1_650_000,
      ["WHEY ISO 2KG (demo)", "Whey Isolate 2kg socola (demo)"],
    ],
    [
      "WHEY-CPX-18",
      "Whey Complex 1.8kg (demo)",
      1_800_000,
      1_350_000,
      ["Whey complex 4lbs (demo)"],
    ],
    [
      "CREA-300",
      "Creatine Monohydrate 300g (demo)",
      450_000,
      300_000,
      ["Creatine 300g (demo)", "crea 300 (demo)"],
    ],
    [
      "MASS-54",
      "Mass Gainer 5.4kg (demo)",
      1_600_000,
      1_200_000,
      ["Mass gainer 12lbs (demo)"],
    ],
    [
      "OATS-45",
      "Yến mạch 4.5kg (demo)",
      300_000,
      200_000,
      ["Yến mạch thùng 4,5kg (demo)"],
    ],
    ["MAG-120", "Magnesium 120 viên (demo)", 500_000, 320_000, []],
    [
      "VIT-100",
      "Vitamin tổng hợp 100 viên (demo)",
      650_000,
      420_000,
      ["One a day 100 viên (demo)"],
    ],
  ],
  HXT: [
    [
      "XT-WHEY-22",
      "Whey xách tay 2.2kg (demo)",
      2_000_000,
      1_500_000,
      ["Whey XT 2.2kg (demo)"],
    ],
    ["XT-PRE", "Pre-workout xách tay (demo)", 750_000, 500_000, []],
    [
      "XT-OMEGA",
      "Omega 3 xách tay (demo)",
      400_000,
      260_000,
      ["Omega3 XT (demo)"],
    ],
    ["XT-BCAA", "BCAA xách tay (demo)", 650_000, 430_000, []],
  ],
};
// Typed by Da Nang staff, deliberately missing from the catalog to show the "chưa quy chuẩn" list.
const UNKNOWN_PRODUCT: DemoProduct = [
  "",
  "Bình lắc tặng kèm có phí (demo)",
  50_000,
  30_000,
  [],
];

const STAFF: Record<BranchCode, string[]> = {
  HN: ["HIẾU", "HIỆP", "ĐỨC", "QUANG", "VIỆT"],
  HCM: ["LINH", "NAM", "TRANG"],
  VINH: ["HÙNG", "MAI"],
  DN: ["PHÚC", "YẾN"],
};
const SOURCES = ["WEB", "FB", "ZALO", "ZALO OA", "Cửa hàng"];
const SUPPLIERS = [
  "NCC A (demo)",
  "NCC B (demo)",
  "NCC C (demo)",
  "NCC D (demo)",
];
const EXPENSES: Array<[string, number]> = [
  ["SHIP NGOÀI", 60_000],
  ["SHIP ANH BE", 150_000],
  ["CHI PHÍ CỬA HÀNG", 350_000],
  ["CHI PHÍ VĂN PHÒNG", 250_000],
  ["VẬN CHUYỂN HÀNG HÓA", 300_000],
  ["PHÍ POS - NGÂN HÀNG", 120_000],
  ["Facebook ads", 900_000],
  ["Google ads", 700_000],
];
const titleRows = (title: string) => [
  [title],
  ["DỮ LIỆU DEMO – không phải số liệu thật"],
  [],
];

export const DEMO_TODAY = "2026-10-31";
const DEMO_FROM = "2026-09-01";

type Spec = {
  branch: BranchCode;
  line: GoodsLine;
  scale: number;
  seed: number;
  bank: string;
};

const buildWorkbook = ({
  branch,
  line,
  scale,
  seed,
  bank,
}: Spec): WorkbookSource => {
  const random = createRandom(seed);
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const catalog =
    line === "HXT"
      ? PRODUCTS.HXT
      : line === "HCT"
        ? PRODUCTS.HCT
        : [...PRODUCTS.HCT, ...PRODUCTS.HXT];
  // Each branch types product names its own way: HN uses the canonical name, the
  // others use an alternative spelling when one exists.
  const variantIndex = { HN: -1, HCM: 0, VINH: 1, DN: 0 }[branch];
  const products: Array<[string, number, number]> = catalog.map(
    ([, name, price, cost, aliases]) => [
      variantIndex >= 0 && aliases[variantIndex] ? aliases[variantIndex] : name,
      price,
      cost,
    ],
  );
  if (branch === "DN")
    products.push([UNKNOWN_PRODUCT[1], UNKNOWN_PRODUCT[2], UNKNOWN_PRODUCT[3]]);
  const customers = Array.from(
    { length: 40 + Math.round(scale * 40) },
    (_, i) => ({
      name: `Khách ${branch} ${String(i + 1).padStart(2, "0")} (demo)`,
      phone: `09${String(seed % 100).padStart(2, "0")}${String(100000 + i * 137).slice(-6)}`,
    }),
  );
  const bankName = bank.replace("Chuyển khoản ", "");
  let counter = 1000 * (seed % 7);
  const prefix = line === "HXT" ? "HD" : "SON";
  const nextCode = () => `${prefix}${++counter}`;

  const store: string[][] = [STORE_HEADER(bankName)];
  const local: string[][] = [LOCAL_HEADER(bankName)];
  const post: string[][] = [POST_HEADER];
  const pending: string[][] = [];
  const tiktok: string[][] = [PLATFORM_HEADER];
  const shopee: string[][] = [PLATFORM_HEADER];
  const expenses: string[][] = [EXPENSE_HEADER];
  const cashbook: string[][] = [];
  let voucher = 0;
  let cashBalance = 5_000_000 + Math.round(random() * 10_000_000);
  let bankBalance = 80_000_000 + Math.round(random() * 200_000_000);
  const openingCash = cashBalance;
  const openingBank = bankBalance;
  let pendingBalance = 0;
  const sold = new Map<string, number>();
  const addSold = (product: string, qty: number) =>
    sold.set(product, (sold.get(product) ?? 0) + qty);
  const book = (
    date: string,
    kind: string,
    src: string,
    code: string,
    group: string,
    text: string,
    fund: string,
    cashIn: number,
    cashOut: number,
    bankIn: number,
    bankOut: number,
    mpos = 0,
  ) => {
    cashBalance += cashIn - cashOut;
    bankBalance += bankIn - bankOut;
    pendingBalance += mpos;
    cashbook.push([
      date,
      kind,
      src,
      code,
      group,
      text,
      fund,
      cashIn ? vnAmount(cashIn) : "",
      cashOut ? vnAmount(cashOut) : "",
      vnAmount(cashBalance),
      bankIn ? vnAmount(bankIn) : "",
      bankOut ? vnAmount(bankOut) : "",
      vnAmount(bankBalance),
      mpos ? vnAmount(mpos) : "",
      mpos ? vnAmount(pendingBalance) : "",
    ]);
  };

  for (
    let day = parseISO(DEMO_FROM);
    format(day, "yyyy-MM-dd") <= DEMO_TODAY;
    day = addDays(day, 1)
  ) {
    const iso = format(day, "yyyy-MM-dd");
    const date = vnDate(iso);
    const daysLeft = Math.round(
      (Date.parse(DEMO_TODAY) - Date.parse(iso)) / 86_400_000,
    );
    const shift = random() < 0.6 ? "Sáng" : "Tối";
    const staff = pick(STAFF[branch]);
    const weekendBoost = day.getDay() === 0 || day.getDay() === 6 ? 1.4 : 1;

    for (
      let i = 0;
      i < Math.round((3 + random() * 5) * scale * weekendBoost);
      i++
    ) {
      const customer =
        random() < 0.35 ? pick(customers.slice(0, 12)) : pick(customers);
      const items = Array.from({ length: random() < 0.25 ? 2 : 1 }, () =>
        pick(products),
      );
      const total = items.reduce((t, [, price]) => t + price, 0);
      const method = pick(["Tiền mặt", bank, bank, "Quẹt thẻ MPOS"]);
      const code = nextCode();
      const check = random() < 0.03 ? "Lệch" : "OK";
      items.forEach(([product, price], index) => {
        addSold(product, 1);
        store.push(
          index === 0
            ? [
                date,
                shift,
                staff,
                code,
                customer.name,
                customer.phone,
                product,
                "1",
                vnAmount(price),
                "0",
                vnAmount(price),
                vnAmount(total),
                method,
                "Đã thanh toán",
                "",
                "",
                "",
                vnAmount(method === "Tiền mặt" ? total : 0),
                vnAmount(method === bank ? total : 0),
                vnAmount(method === "Quẹt thẻ MPOS" ? total : 0),
                check,
                check === "OK" ? "Đã vào sổ quỹ" : "",
              ]
            : [
                "",
                "",
                "",
                "",
                "",
                "",
                product,
                "1",
                vnAmount(price),
                "0",
                vnAmount(price),
              ],
        );
      });
      if (check === "OK") {
        if (method === "Tiền mặt")
          book(
            date,
            "Thu",
            "Đơn CH",
            code,
            "BÁN HÀNG",
            `Thu đơn ${code} – tiền mặt`,
            "Tiền mặt",
            total,
            0,
            0,
            0,
          );
        else if (method === bank)
          book(
            date,
            "Thu",
            "Đơn CH",
            code,
            "BÁN HÀNG",
            `Thu đơn ${code} – CK`,
            bankName,
            0,
            0,
            total,
            0,
          );
        else if (daysLeft <= 6) {
          book(
            date,
            "Thu",
            "Đơn CH",
            code,
            "BÁN HÀNG",
            `Thu đơn ${code} – MPOS chờ`,
            "MPOS chờ về",
            0,
            0,
            0,
            0,
            total,
          );
          pending.push([
            "",
            "",
            "",
            "",
            date,
            "Đơn CH",
            code,
            `${vnAmount(total)} đ`,
            String(daysLeft),
          ]);
        } else
          book(
            date,
            "Thu",
            "Đơn CH",
            code,
            "BÁN HÀNG",
            `Thu đơn ${code} – MPOS về`,
            bankName,
            0,
            0,
            total,
            0,
          );
      }
    }

    for (let i = 0; i < Math.round((2 + random() * 6) * scale); i++) {
      const customer = pick(customers);
      const [product, price] = pick(products);
      const ship = pick([0, 0, 20_000, 30_000]);
      const total = price + ship;
      const delivered = daysLeft > 1 || random() < 0.5;
      const status = delivered
        ? random() < 0.03
          ? "Hoàn-Huỷ"
          : "Đã giao"
        : pick(["Đã xác nhận", "Đang giao"]);
      const method = pick(["Tiền mặt", "Tiền mặt", bank]);
      const paid = status === "Đã giao" || method === bank;
      const code = nextCode();
      if (status === "Đã giao") addSold(product, 1);
      local.push([
        date,
        pick(SOURCES),
        code,
        customer.name,
        customer.phone,
        `Địa chỉ demo`,
        product,
        "1",
        vnAmount(price),
        "0",
        vnAmount(ship),
        vnAmount(total),
        status,
        method,
        paid ? "Đã thanh toán" : "Chưa thanh toán",
        "",
        "",
        "",
        "",
        vnAmount(paid && method === "Tiền mặt" ? total : 0),
        vnAmount(paid && method === bank ? total : 0),
        "0",
        "OK",
        paid ? "Đã vào sổ quỹ" : "",
        "",
        "",
        staff,
        shift,
      ]);
      if (paid)
        book(
          date,
          "Thu",
          "Đơn NT",
          code,
          "NT",
          `Thu đơn ${code}`,
          method === bank ? bankName : "Tiền mặt",
          method === "Tiền mặt" ? total : 0,
          0,
          method === bank ? total : 0,
          0,
        );
    }

    if (random() < 0.7 * scale) {
      const customer = pick(customers);
      const [product, price] = pick(products);
      const cod = random() < 0.7;
      const delivered = daysLeft > 4;
      const paid = delivered && (!cod || random() < 0.6);
      const code = nextCode();
      if (delivered) addSold(product, 1);
      post.push([
        date,
        pick(SOURCES),
        code,
        `VD${counter}`,
        customer.name,
        customer.phone,
        `Địa chỉ demo, tỉnh khác`,
        `${product} x 1`,
        "1",
        vnAmount(price),
        "0",
        "0",
        vnAmount(price),
        cod ? "COD (thu hộ BĐ)" : bank,
        random() < 0.08 ? "Gửi lại" : "Mới",
        delivered ? "Đã giao" : "Đang giao",
        paid ? "Đã thanh toán" : "Chưa thanh toán",
        "",
        "",
        "",
        staff,
        shift,
      ]);
      if (!cod && paid)
        book(
          date,
          "Thu",
          "Đơn Bưu điện",
          code,
          "ĐƠN TỈNH",
          `Thu đơn ${code}`,
          bankName,
          0,
          0,
          price,
          0,
        );
    }

    if (line !== "HXT") {
      for (const [list, p] of [
        [tiktok, "TT"],
        [shopee, "SP"],
      ] as const) {
        if (random() < 0.6 * scale) {
          const revenue = pick(PRODUCTS.HCT)[2];
          const fee = Math.round(revenue * 0.12);
          const bad = random() < 0.05;
          list.push([
            date,
            `${p}${counter}${list.length}`,
            vnAmount(revenue),
            vnAmount(revenue - fee + (bad ? 10_000 : 0)),
            vnAmount(fee),
            bad ? "Lệch" : "OK",
          ]);
        }
      }
    }

    if (random() < 0.7) {
      const [group, base] = pick(EXPENSES);
      const amount = Math.round(base * (0.5 + random()) * scale);
      const fund = random() < 0.8 ? "Tiền mặt" : bankName;
      const code = `CP-${String(++voucher).padStart(4, "0")}`;
      expenses.push([
        date,
        "Chi",
        group,
        `${group.toLowerCase()} (demo)`,
        vnAmount(amount),
        fund,
        "",
        "OK",
        staff,
        "",
        "",
        code,
      ]);
      book(
        date,
        "Chi",
        "Bảng Chi phí",
        code,
        group,
        `${group.toLowerCase()} (demo)`,
        fund,
        0,
        fund === "Tiền mặt" ? amount : 0,
        0,
        fund === "Tiền mặt" ? 0 : amount,
      );
    }
    // Monday: deposit most of the cash drawer into the bank account.
    if (day.getDay() === 1 && cashBalance > 5_000_000) {
      const amount = Math.round((cashBalance - 3_000_000) / 100_000) * 100_000;
      const code = `CP-${String(++voucher).padStart(4, "0")}`;
      expenses.push([
        date,
        "Chi",
        "NỘP - CHUYỂN QUỸ (CHI)",
        "Nộp tiền mặt vào ngân hàng (demo)",
        vnAmount(amount),
        "Tiền mặt",
        bankName,
        "OK",
        staff,
        "",
        "",
        code,
      ]);
      book(
        date,
        "Chi",
        "Bảng Chi phí",
        code,
        "NỘP - CHUYỂN QUỸ (CHI)",
        "Nộp tiền mặt (demo)",
        "Tiền mặt",
        0,
        amount,
        amount,
        0,
      );
    }
    if (day.getDate() === 1 || day.getDate() === 10) {
      const [group, amount] =
        day.getDate() === 1
          ? ["CHI PHÍ CỬA HÀNG", 15_000_000]
          : ["LƯƠNG - THƯỞNG", 28_000_000];
      const code = `CP-${String(++voucher).padStart(4, "0")}`;
      const value = Math.round(amount * scale);
      expenses.push([
        date,
        "Chi",
        group,
        `${day.getDate() === 1 ? "Tiền mặt bằng tháng" : "Lương nhân viên"} (demo)`,
        vnAmount(value),
        bankName,
        "",
        "OK",
        "Kế toán",
        "",
        "",
        code,
      ]);
      book(
        date,
        "Chi",
        "Bảng Chi phí",
        code,
        group,
        `${group.toLowerCase()} (demo)`,
        bankName,
        0,
        0,
        0,
        value,
      );
    }
    if (day.getDate() === 5 || day.getDate() === 20) {
      const amount = Math.round((20_000_000 + random() * 40_000_000) * scale);
      const code = `CP-${String(++voucher).padStart(4, "0")}`;
      expenses.push([
        date,
        "Chi",
        "CÔNG NỢ NCC",
        `Trả ${pick(SUPPLIERS)} (demo)`,
        vnAmount(amount),
        bankName,
        "",
        "OK",
        "Kế toán",
        "",
        "",
        code,
      ]);
      book(
        date,
        "Chi",
        "Bảng Chi phí",
        code,
        "CÔNG NỢ NCC",
        "Trả NCC (demo)",
        bankName,
        0,
        0,
        0,
        amount,
      );
    }
  }

  const inventory = catalog.map(([code, name, , , aliases]) => {
    const typed =
      variantIndex >= 0 && aliases[variantIndex] ? aliases[variantIndex] : name;
    const qty = Math.max(
      0,
      Math.round(10 + random() * 60 * scale - (sold.get(typed) ?? 0) * 0.3),
    );
    return [
      vnDate(DEMO_TODAY),
      code,
      typed,
      String(qty),
      String(Math.round(8 * scale)),
    ];
  });
  const ledger: string[][] = [];
  SUPPLIERS.slice(0, 2 + Math.round(scale * 2)).forEach((supplier, i) => {
    ledger.push([
      vnDate(DEMO_FROM),
      supplier,
      "Nợ đầu kỳ",
      "",
      "Số dư đầu 01/09",
      vnAmount(Math.round((20_000_000 + random() * 40_000_000) * scale)),
      vnDate("2026-09-15"),
      "",
    ]);
    for (let month = 9; month <= 10; month++) {
      const purchaseDay = `2026-${String(month).padStart(2, "0")}-${String(3 + i * 6).padStart(2, "0")}`;
      const amount = Math.round((30_000_000 + random() * 60_000_000) * scale);
      ledger.push([
        vnDate(purchaseDay),
        supplier,
        "Nhập hàng",
        `PN${month}${i}`,
        "Nhập hàng tháng (demo)",
        vnAmount(amount),
        vnDate(format(addDays(parseISO(purchaseDay), 30), "yyyy-MM-dd")),
        "",
      ]);
      const payDay = `2026-${String(month).padStart(2, "0")}-${month === 10 && i >= 2 ? "28" : "20"}`;
      if (!(month === 10 && i === 1)) {
        ledger.push([
          vnDate(payDay),
          supplier,
          "Trả tiền",
          `CP-${month}${i}`,
          "Chuyển khoản trả NCC (demo)",
          vnAmount(Math.round(amount * (0.6 + random() * 0.5))),
          "",
          "",
        ]);
      }
    }
  });
  const catalogRows = catalog.map(([code, name, , cost, aliases]) => [
    vnDate(DEMO_FROM),
    code,
    name,
    name.includes("xách tay") ? "XT" : "Cty",
    name.toLowerCase().includes("whey") ? "Whey" : "Khác",
    "",
    "hộp",
    vnAmount(cost),
    aliases.join("; "),
  ]);

  const suffix = line === "HXT" ? "HXT kiot" : line === "HCT" ? "HKD" : branch;
  const tabs: Record<string, string[][]> = {
    [`Đơn CH ${suffix}`]: [...titleRows("Đơn CH"), ...store],
    [`Đơn NT ${suffix}`]: [...titleRows("Đơn NT"), ...local],
    "Đơn Bưu điện": [...titleRows("Đơn Bưu điện"), ...post],
    "Bảng Chi phí": [...titleRows("Bảng Chi phí"), ...expenses],
    [`MPOS về ${bankName}`]: [["MPOS"], [], [], ["Mã đơn (nhập)"], ...pending],
    [`Sổ quỹ ${line}`]: [
      ["SỔ QUỸ (demo)"],
      [],
      [
        "Từ ngày",
        vnDate(DEMO_FROM),
        "Đến ngày",
        vnDate(DEMO_TODAY),
        "",
        "Chốt thực tế ngày",
        vnDate(DEMO_TODAY),
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
        vnAmount(openingCash),
        vnAmount(openingCash),
        "",
        "",
        vnAmount(cashBalance),
        vnAmount(cashBalance - (random() < 0.3 ? 50_000 : 0)),
        "",
        vnAmount(cashBalance),
      ],
      [
        `${bankName} (gồm MPOS)`,
        vnAmount(openingBank),
        vnAmount(openingBank),
        "",
        "",
        vnAmount(bankBalance),
        "",
        "",
        vnAmount(bankBalance),
      ],
      ["Tổng"],
      [],
      [],
      cashbookHeader(bankName),
      ...cashbook,
    ],
    "Tồn kho": [...titleRows("Tồn kho"), inventoryHeader, ...inventory],
    "Công nợ NCC": [...titleRows("Công nợ NCC"), ledgerHeader, ...ledger],
    // In production the catalog is one shared tab; the demo repeats it in the HN file only.
    ...(branch === "HN"
      ? {
          "Danh mục sản phẩm": [
            ...titleRows("Danh mục sản phẩm"),
            catalogHeader,
            ...catalogRows,
          ],
        }
      : {}),
  };
  if (line !== "HXT") {
    tabs["Đơn Tiktok"] = [...titleRows("Đơn Tiktok"), ...tiktok];
    tabs["Đơn Shopee"] = [...titleRows("Đơn Shopee"), ...shopee];
  }
  return { branch, line, tabs };
};

export const demoWorkbooks = (): WorkbookSource[] => [
  buildWorkbook({
    branch: "HN",
    line: "HCT",
    scale: 1,
    seed: 20261001,
    bank: "Chuyển khoản BIDV",
  }),
  buildWorkbook({
    branch: "HN",
    line: "HXT",
    scale: 0.5,
    seed: 20261002,
    bank: "Chuyển khoản MB",
  }),
  buildWorkbook({
    branch: "HCM",
    line: "HCT",
    scale: 0.8,
    seed: 20261003,
    bank: "Chuyển khoản BIDV",
  }),
  buildWorkbook({
    branch: "HCM",
    line: "HXT",
    scale: 0.4,
    seed: 20261004,
    bank: "Chuyển khoản MB",
  }),
  buildWorkbook({
    branch: "VINH",
    line: "GOP",
    scale: 0.45,
    seed: 20261005,
    bank: "Chuyển khoản BIDV",
  }),
  buildWorkbook({
    branch: "DN",
    line: "GOP",
    scale: 0.5,
    seed: 20261006,
    bank: "Chuyển khoản BIDV",
  }),
];
