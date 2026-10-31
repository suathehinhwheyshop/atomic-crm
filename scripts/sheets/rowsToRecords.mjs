// Pure conversion from a Google Sheets tab (array of rows, first row = headers)
// to CRM records for the `data/` JSON folder. No I/O here so it is unit-testable.

const LIST_FIELDS = new Set(["tags", "contact_ids", "categories"]);
const NUMBER_FIELDS = new Set(["id", "amount", "size", "index"]);
const BOOLEAN_FIELDS = new Set(["administrator", "disabled", "has_newsletter"]);
const DATE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "archived_at",
  "date",
  "due_date",
  "done_date",
  "first_seen",
  "last_seen",
  "expected_closing_date",
]);

const isIdField = (field) => field === "id" || field.endsWith("_id");

const toNumberOrString = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
};

const parseCell = (field, raw) => {
  const value = String(raw).trim();
  if (value.startsWith("[") || value.startsWith("{")) return JSON.parse(value);
  if (LIST_FIELDS.has(field)) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (field === "categories" ? item : toNumberOrString(item)));
  }
  if (BOOLEAN_FIELDS.has(field)) return /^(true|1|x|có)$/i.test(value);
  if (NUMBER_FIELDS.has(field) || isIdField(field)) {
    return field === "user_id" ? value : toNumberOrString(value);
  }
  if (DATE_FIELDS.has(field)) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      throw new Error(`Invalid date "${value}" in column "${field}"`);
    }
    return date.toISOString();
  }
  return value;
};

// Convenience columns for the contacts tab so the sheet stays human-editable:
// "email" / "phone" become the email_jsonb / phone_jsonb arrays.
const expandContactShortcuts = (record) => {
  const { email, phone, ...rest } = record;
  return {
    ...rest,
    ...(email !== undefined && !rest.email_jsonb
      ? { email_jsonb: [{ email, type: "Work" }] }
      : {}),
    ...(phone !== undefined && !rest.phone_jsonb
      ? { phone_jsonb: [{ number: String(phone), type: "Work" }] }
      : {}),
  };
};

export const rowsToRecords = (rows, tabName = "sheet") => {
  if (!rows?.length) return [];
  const [headers, ...body] = rows;
  const fields = headers.map((h) => String(h).trim());
  if (!fields.includes("id")) {
    throw new Error(`Tab "${tabName}" must have an "id" column`);
  }
  return body
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row, rowIndex) => {
      const entries = fields
        .map((field, i) => [field, row[i]])
        .filter(([field, cell]) => field && String(cell ?? "").trim() !== "")
        .map(([field, cell]) => {
          try {
            return [field, parseCell(field, cell)];
          } catch (error) {
            throw new Error(
              `Tab "${tabName}", row ${rowIndex + 2}: ${error.message}`,
            );
          }
        });
      const record = Object.fromEntries(entries);
      return tabName === "contacts" ? expandContactShortcuts(record) : record;
    });
};
