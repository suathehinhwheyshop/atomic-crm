# WheyShop Ops dashboard (prototype)

Sales, customer and cash dashboard built on top of the branch report spreadsheets
("BÁO CÁO BÁN HÀNG CH - HCT/HXT - <branch>"). The spreadsheets stay the input tool;
the dashboard reads their input tabs and recomputes every figure with the same rules
as the sheet formulas.

## Pages

| Page | Content |
|---|---|
| Tổng quan | KPIs, revenue per day and channel, channel table with payment split, best sellers, staff ranking, top alerts |
| Đơn hàng | Orders from store / local delivery / post office / TikTok / Shopee tabs, search, status filters, order detail |
| Khách hàng | Customers merged by phone number across channels, segments (VIP / returning / new), purchase history, call / Zalo links |
| Sổ quỹ & Chi phí | Fund movements in the period, income / expense per group, pending MPOS payments, expense rows |
| Ca & Nhân viên | Same grouping as the "Tổng hợp ca" tab (date + staff + channel) and staff totals |
| Cần xử lý | Rows the sheets flag (check not OK), undelivered local orders, unpaid post orders, MPOS waiting 3+ days, platform mismatches |

Global filters: branch (HN, SG, Vinh, ĐN), goods line (HCT / HXT), period.

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
- `scripts/ops-server.mjs`: reads the spreadsheets with the service account and serves the dashboard
