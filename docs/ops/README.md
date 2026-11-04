# WheyShop Ops dashboard (prototype)

Sales, customer and cash dashboard built on top of the branch report spreadsheets
("BÁO CÁO BÁN HÀNG CH - HCT/HXT - <branch>"). The spreadsheets stay the input tool;
the dashboard reads their input tabs and recomputes every figure with the same rules
as the sheet formulas.

## Sections

| Section | Tabs |
|---|---|
| Tổng quan | KPIs, per-branch table, revenue per day and channel, channel table, best sellers, staff, top alerts |
| Hàng hóa | **Số lượng bán ra** (units sold per week / month and per product, by branch), **Tồn kho** (current stock per branch, proposed tab), **Danh mục sản phẩm** (catalog, aliases, unmatched names) |
| Tài chính | **Báo cáo gộp** (revenue per channel, result, cashbook opening / movements / closing, supplier debt opening / closing, money not yet in the cashbook, per branch), **Sổ quỹ** (opening / inflow / outflow / closing per fund and branch from the Sổ quỹ tab, actual vs book), **Công nợ NCC** (opening / purchases / payments / closing per branch, ledger per supplier with ageing, proposed tab), **Kênh bán** (revenue per channel and branch, payment methods, one channel per week / month, money not yet in the cashbook), **Doanh thu** (per week / month by branch), **Chi phí** (monthly by branch, by group, supplier payments) |
| Vận hành | Đơn hàng, Khách hàng, Sổ quỹ & Chi phí, Ca & Nhân viên, Cần xử lý |

Global filters: branch (HN, HCM, Vinh, ĐN), goods line (HCT / HXT / merged), period.
Branch units: HN and HCM have one file per goods line (Cty, XT); Vinh and ĐN have one merged file.

## Source files per branch

Each branch has a sales file ("Báo cáo bán hàng", kind `sales`) and an accounting
file ("BCTC", kind `bctc`); HN and HCM also have a stock file ("Hàng hóa - Kho",
kind `kho`). Da Nang and Vinh keep company and hand-carried goods in one file
(line `GOP`). `ops/sources.example.json` lists the 14 entries.

- `sales`: orders per channel, expenses, cashbook, pending MPOS. Tab and column
  names differ per branch (Đơn CH / Đơn Cửa hàng / Đơn Tại Cửa hàng, SĐT / Số điện
  thoại, CK BIDV / Chuyển khoản ngân hàng, MB / OCB / AT); the parser accepts all of them.
- `bctc`: monthly P&L ("BCTC tháng" / "Báo cáo tài chính"), daily revenue with cost
  of goods ("DT ngày" / "Doanh thu ngày"), supplier ledger ("Công nợ NCC" / "Công nợ
  Nhà cung cấp": one row per purchase or payment, "Số dư đầu kỳ" rows are opening
  balances), supplier info ("Tóm tắt công nợ"), payment schedule ("Lịch TT NCC").
  Cost of goods and supplier balances come from here; the catalog-based cost is
  only a fallback.
- `kho`: hand-carried stock ("Hàng xách tay tồn kho"), purchase orders ("Hàng công
  ty đã đặt"), receipts ("Hàng công ty mới về"), product list ("Danh mục", also used
  as the product catalog).

The older proposed tabs (`Danh mục sản phẩm`, `Tồn kho`, `Công nợ NCC` inside a
sales file; templates in `ops/templates/`) are still read when present.

## Run

```bash
npm run dev:ops            # demo data (anonymized, generated in ops/data/demoWorkbooks.ts)
```

Live data (refreshed every 60 s, server cache 30 s):

```bash
cp ops/sources.example.json ops-sources.json   # fill the spreadsheet ids (gitignored)
npm run build:ops
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run start:ops
# open http://127.0.0.1:4300
```

Share every spreadsheet (Viewer) with the service account email. The server has no
login and listens on 127.0.0.1 only: add authentication before exposing it.

## Code map

- `ops/model/sheet.ts`: header-row detection, Vietnamese number and date parsing
- `ops/model/parseWorkbook.ts`: tab rows to orders, platform orders, cash entries, pending card payments
- `ops/model/metrics.ts`: filters, KPIs, channel / day / shift summaries, customers, alerts
- `ops/model/reports.ts`: per-branch matrices (week / month), inventory, debt, fund balance, statement
- `ops/model/finance.ts`: period summaries (fund opening / closing, debt opening / closing, channels per branch, money not yet in the cashbook)
- `ops/model/parseExtras.ts`: Sổ quỹ running balances and the Tồn kho tab
- `ops/model/catalog.ts`: product catalog parsing and name matching
- `ops/model/supplierLedger.ts`: supplier ledger parsing, balances and ageing
- `scripts/ops-server.mjs`: reads the spreadsheets with the service account and serves the dashboard
