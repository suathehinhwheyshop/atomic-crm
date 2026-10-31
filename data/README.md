# data/ — JSON source for the WheyShop CRM prototype

One JSON file per resource. The prototype (`npm run dev:prototype`, or
`npm run build:prototype && npm run preview:prototype`) loads these files at build time.
Derived fields (`nb_contacts`, `nb_deals`, `nb_tasks`, `company_name`, kanban `index`,
contact `status` from the latest note) are computed by `prototype/buildDb.ts`.

The current files hold sample records only (names marked "Mẫu", amounts = 0).

## Sync from Google Sheets

1. Share the spreadsheet (Viewer) with the service account email.
2. Create one tab per file: `sales`, `tags`, `companies`, `contacts`, `contact_notes`,
   `deals`, `deal_notes`, `tasks`. Row 1 = field names (same keys as the JSON files).
3. Run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json SHEET_ID=<id> npm run sync:sheets
```

Cell conventions: `tags`, `contact_ids`, `categories` are comma-separated lists;
`id`, `*_id` and `amount` are numbers; dates are any parseable date; in the `contacts`
tab, `email` / `phone` columns become `email_jsonb` / `phone_jsonb`; a cell starting
with `[` or `{` is parsed as JSON. Missing tabs keep their current JSON file.

Never commit the service account key (`service-account*.json` is gitignored).
