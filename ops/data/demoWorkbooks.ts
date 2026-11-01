// Anonymized demo data shaped exactly like the real report spreadsheets
// (same tab titles, header rows and Vietnamese formats), so the same parser runs
// on demo and live data. No real customer appears here.
import type { GoodsLine, WorkbookSource } from "../model/types";

const createRandom = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};

const vnAmount = (n: number) =>
  Math.round(n).toLocaleString("de-DE").replace(/,/g, ".");
const vnDate = (day: number) => `${String(day).padStart(2, "0")}/10/2026`;

const PRODUCTS: Record<GoodsLine, Array<[string, number]>> = {
  HCT: [
    ["Whey Isolate 2kg (demo)", 2_200_000],
    ["Whey Complex 1.8kg (demo)", 1_800_000],
    ["Creatine Monohydrate 300g (demo)", 450_000],
    ["Mass Gainer 5.4kg (demo)", 1_600_000],
    ["Yến mạch 4.5kg (demo)", 300_000],
    ["Magnesium 120 viên (demo)", 500_000],
  ],
  HXT: [
    ["Whey xách tay 2.2kg (demo)", 2_000_000],
    ["Pre-workout xách tay (demo)", 750_000],
    ["Omega 3 xách tay (demo)", 400_000],
    ["BCAA xách tay (demo)", 650_000],
  ],
};
const STAFF = ["HIẾU", "HIỆP", "ĐỨC", "QUANG", "VIỆT"];
const SOURCES = ["WEB", "FB", "ZALO", "ZALO OA", "Cửa hàng"];
const CUSTOMERS = Array.from({ length: 60 }, (_, i) => ({
  name: `Khách demo ${String(i + 1).padStart(2, "0")}`,
  phone: `0900${String(100000 + i * 137).slice(-6)}`,
}));
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
  "Ngày tiền về",
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
  "Ngày tiền về TK",
  "Tiền thực nhận",
  "Kiểm tra",
  "Nhân viên xử lý đơn",
  "Ca (Sáng/Tối)",
];
const PLATFORM_HEADER = [
  "Ngày",
  "ID đơn hàng",
  "Doanh thu",
  "Doanh thu thực nhận",
  "Chi phí",
  "Hệ thống",
];
const EXPENSE_HEADER = [
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
];
const EXPENSES: Array<[string, number]> = [
  ["SHIP NGOÀI", 60_000],
  ["SHIP ANH BE", 150_000],
  ["CHI PHÍ CỬA HÀNG", 350_000],
  ["CHI PHÍ VĂN PHÒNG", 250_000],
  ["VẬN CHUYỂN HÀNG HÓA", 300_000],
  ["PHÍ POS - NGÂN HÀNG", 120_000],
];
const titleRows = (title: string) => [
  [title],
  ["DỮ LIỆU DEMO – không phải số liệu thật"],
  [],
];

const LAST_DAY = 31;

const buildWorkbook = (line: GoodsLine, seed: number): WorkbookSource => {
  const random = createRandom(seed);
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const bank = line === "HCT" ? "Chuyển khoản BIDV" : "Chuyển khoản MB";
  const scale = line === "HCT" ? 1 : 0.5;
  let counter = 7000;
  const nextCode = () => `${line === "HCT" ? "SON" : "HD"}${++counter}`;

  const store: string[][] = [STORE_HEADER];
  const local: string[][] = [LOCAL_HEADER];
  const post: string[][] = [POST_HEADER];
  const pending: string[][] = [];
  const tiktok: string[][] = [PLATFORM_HEADER];
  const shopee: string[][] = [PLATFORM_HEADER];
  const expenses: string[][] = [EXPENSE_HEADER];
  let voucher = 0;

  for (let day = 1; day <= LAST_DAY; day++) {
    const date = vnDate(day);
    const shift = random() < 0.6 ? "Sáng" : "Tối";
    const staff = pick(STAFF);

    for (let i = 0; i < Math.round((3 + random() * 5) * scale); i++) {
      const customer =
        random() < 0.35 ? pick(CUSTOMERS.slice(0, 12)) : pick(CUSTOMERS);
      const items = Array.from({ length: random() < 0.25 ? 2 : 1 }, () =>
        pick(PRODUCTS[line]),
      );
      const total = items.reduce((t, [, price]) => t + price, 0);
      const method = pick(["Tiền mặt", bank, bank, "Quẹt thẻ MPOS"]);
      const code = nextCode();
      const check = random() < 0.04 ? "Lệch" : "OK";
      items.forEach(([product, price], index) =>
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
        ),
      );
      if (method === "Quẹt thẻ MPOS" && day > LAST_DAY - 6) {
        pending.push([
          "",
          "",
          "",
          "",
          date,
          "Đơn CH",
          code,
          `${vnAmount(total)} đ`,
          String(LAST_DAY - day),
        ]);
      }
    }

    for (let i = 0; i < Math.round((2 + random() * 6) * scale); i++) {
      const customer = pick(CUSTOMERS);
      const [product, price] = pick(PRODUCTS[line]);
      const ship = pick([0, 0, 20_000, 30_000]);
      const total = price + ship;
      const delivered = day < LAST_DAY - 1 || random() < 0.5;
      const status = delivered
        ? random() < 0.03
          ? "Hoàn-Huỷ"
          : "Đã giao"
        : pick(["Đã xác nhận", "Đang giao"]);
      const method = pick(["Tiền mặt", "Tiền mặt", bank]);
      const paid = status === "Đã giao" || method === bank;
      local.push([
        date,
        pick(SOURCES),
        nextCode(),
        customer.name,
        customer.phone,
        `Địa chỉ demo, Hà Nội`,
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
    }

    if (random() < 0.7) {
      const customer = pick(CUSTOMERS);
      const [product, price] = pick(PRODUCTS[line]);
      const cod = random() < 0.7;
      const delivered = day < LAST_DAY - 4;
      const paid = delivered && (!cod || random() < 0.6);
      post.push([
        date,
        pick(SOURCES),
        nextCode(),
        `VD${day}${counter}`,
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
    }

    if (line === "HCT") {
      for (const [list, prefix] of [
        [tiktok, "TT"],
        [shopee, "SP"],
      ] as const) {
        if (random() < 0.6) {
          const revenue = pick(PRODUCTS.HCT)[1];
          const fee = Math.round(revenue * 0.12);
          const bad = random() < 0.05;
          list.push([
            date,
            `${prefix}${day}${counter}`,
            vnAmount(revenue),
            vnAmount(revenue - fee + (bad ? 10_000 : 0)),
            vnAmount(fee),
            bad ? "Lệch" : "OK",
          ]);
        }
      }
    }

    if (random() < 0.6) {
      const [group, amount] = pick(EXPENSES);
      expenses.push([
        date,
        "Chi",
        group,
        `${group.toLowerCase()} (demo)`,
        vnAmount(amount * (0.5 + random())),
        random() < 0.85 ? "Tiền mặt" : line === "HCT" ? "BIDV" : "MB",
        "",
        "OK",
        staff,
        "",
        "",
        `CP-${String(++voucher).padStart(4, "0")}`,
      ]);
    }
  }

  const storeTab = line === "HCT" ? "Đơn CH HKD" : "Đơn CH HXT kiot";
  const localTab = line === "HCT" ? "Đơn NT HKD" : "Đơn NT HXT kiot";
  const tabs: Record<string, string[][]> = {
    [storeTab]: [...titleRows(storeTab), ...store],
    [localTab]: [...titleRows(localTab), ...local],
    "Đơn Bưu điện": [...titleRows("Đơn Bưu điện"), ...post],
    "Bảng Chi phí": [...titleRows("Bảng Chi phí"), ...expenses],
    [line === "HCT" ? "MPOS về BIDV" : "MPOS về MB"]: [
      ["MPOS"],
      [],
      [],
      ["Mã đơn (nhập)"],
      ...pending,
    ],
  };
  if (line === "HCT") {
    tabs["Đơn Tiktok"] = [...titleRows("Đơn Tiktok"), ...tiktok];
    tabs["Đơn Shopee"] = [...titleRows("Đơn Shopee"), ...shopee];
  }
  return { branch: "HN", line, tabs };
};

export const DEMO_TODAY = "2026-10-31";

export const demoWorkbooks = (): WorkbookSource[] => [
  buildWorkbook("HCT", 20261001),
  buildWorkbook("HXT", 20261002),
];
