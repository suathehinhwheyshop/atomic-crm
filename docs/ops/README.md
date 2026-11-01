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
| Tài chính | **Doanh thu** (per week / month by branch, orders, revenue − operating expenses), **Chi phí** (monthly by branch, by group, supplier payments), **Tồn quỹ** (cash / bank balance over time from the Sổ quỹ tab, actual vs book), **Công nợ NCC** (supplier ledger per branch and supplier with ageing, proposed tab), **Báo cáo gộp** (monthly statement per branch) |
| Vận hành | Đơn hàng, Khách hàng, Sổ quỹ & Chi phí, Ca & Nhân viên, Cần xử lý |

Global filters: branch (HN, HCM, Vinh, ĐN), goods line (HCT / HXT / merged), period.
Branch units: HN and HCM have one file per goods line (Cty, XT); Vinh and ĐN have one merged file.

## Proposed tabs (not in the current files)

Header row starts with "Ngày". CSV templates with one example row are in `ops/templates/`.

- `Danh mục sản phẩm` (one shared tab, read from any file): Ngày | Mã SP | Tên chuẩn | Thương hiệu | Nhóm | Quy cách | Đơn vị | Giá vốn | Tên khác (other spellings, separated by ";"). The app maps typed product names to the catalog (exact name or alias, else the longest alias whose words all appear in the name); unmatched names are listed on Hàng hóa › Danh mục sản phẩm. Cost prices from the catalog give gross profit.
- `Tồn kho` (per file): Ngày | Mã SP | Sản phẩm | Tồn | Tồn tối thiểu (one row per product, updated at each stock count).
- `Công nợ NCC` (per file, a ledger): Ngày | Nhà cung cấp | Loại (Nợ đầu kỳ / Nhập hàng / Trả tiền) | Số phiếu | Diễn giải | Số tiền | Hạn thanh toán | Ghi chú. Balances, FIFO allocation of payments and ageing (not due / overdue ≤30 / >30 days) are computed in the app.

Until they exist the dashboard shows demo numbers on those pages, with an amber notice.

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
- `ops/model/parseExtras.ts`: Sổ quỹ running balances and the Tồn kho tab
- `ops/model/catalog.ts`: product catalog parsing and name matching
- `ops/model/supplierLedger.ts`: supplier ledger parsing, balances and ageing
- `scripts/ops-server.mjs`: reads the spreadsheets with the service account and serves the dashboard
