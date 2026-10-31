import { describe, expect, it } from "vitest";

import { rowsToRecords } from "./rowsToRecords.mjs";

describe("rowsToRecords", () => {
  it("maps header row to fields and parses ids, lists and dates", () => {
    const rows = [
      [
        "id",
        "first_name",
        "company_id",
        "tags",
        "first_seen",
        "email",
        "phone",
      ],
      ["3", "Minh", "0", "1, 2", "2026-10-01", "minh@example.com", "0910"],
    ];

    const [contact] = rowsToRecords(rows, "contacts");

    expect(contact).toEqual({
      id: 3,
      first_name: "Minh",
      company_id: 0,
      tags: [1, 2],
      first_seen: new Date("2026-10-01").toISOString(),
      email_jsonb: [{ email: "minh@example.com", type: "Work" }],
      phone_jsonb: [{ number: "0910", type: "Work" }],
    });
  });

  it("keeps a plain email column for sales records", () => {
    const rows = [
      ["id", "user_id", "first_name", "email", "administrator"],
      ["0", "0", "Admin", "admin@example.com", "TRUE"],
    ];

    expect(rowsToRecords(rows, "sales")).toEqual([
      {
        id: 0,
        user_id: "0",
        first_name: "Admin",
        email: "admin@example.com",
        administrator: true,
      },
    ]);
  });

  it("skips empty rows and omits empty cells", () => {
    const rows = [
      ["id", "name", "description"],
      ["1", "Gym", ""],
      ["", "", ""],
    ];

    expect(rowsToRecords(rows, "companies")).toEqual([{ id: 1, name: "Gym" }]);
  });

  it("keeps category values as strings", () => {
    const rows = [
      ["id", "categories"],
      ["1", "whey, combo"],
    ];

    expect(rowsToRecords(rows, "deals")[0].categories).toEqual([
      "whey",
      "combo",
    ]);
  });

  it("throws with tab and row when a date is invalid", () => {
    const rows = [
      ["id", "due_date"],
      ["1", "not a date"],
    ];

    expect(() => rowsToRecords(rows, "tasks")).toThrow(
      'Tab "tasks", row 2: Invalid date "not a date" in column "due_date"',
    );
  });

  it("throws when the id column is missing", () => {
    expect(() => rowsToRecords([["name"], ["Gym"]], "companies")).toThrow(
      'Tab "companies" must have an "id" column',
    );
  });
});
