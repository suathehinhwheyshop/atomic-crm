import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

/**
 * Raw records as stored in the `data/` JSON folder (or synced from Google Sheets).
 * Derived fields (counters, company_name, kanban index, contact status) are
 * optional: buildDb computes them so the source data stays minimal.
 */
export type RawDb = Omit<Db, "configuration">;

const byDateAsc = (a: { date: string }, b: { date: string }) =>
  new Date(a.date).valueOf() - new Date(b.date).valueOf();

export const buildDb = (raw: RawDb): Db => {
  const countBy = <T>(items: T[], key: (item: T) => unknown) =>
    items.reduce((acc, item) => {
      const k = key(item);
      acc.set(k, (acc.get(k) ?? 0) + 1);
      return acc;
    }, new Map<unknown, number>());

  const contactsPerCompany = countBy(raw.contacts, (c) => c.company_id);
  const dealsPerCompany = countBy(raw.deals, (d) => d.company_id);
  const openTasksPerContact = countBy(
    raw.tasks.filter((t) => !t.done_date),
    (t) => t.contact_id,
  );
  const latestStatus = new Map(
    [...raw.contact_notes].sort(byDateAsc).map((n) => [n.contact_id, n.status]),
  );
  const companyNames = new Map(raw.companies.map((c) => [c.id, c.name]));
  const stageIndex = new Map<string, number>();

  return {
    sales: raw.sales.map((s) => ({ secondary_emails: [], ...s })),
    tags: raw.tags,
    companies: raw.companies.map((c) => ({
      ...c,
      logo: c.logo ?? { src: "", title: c.name },
      context_links: c.context_links ?? [],
      nb_contacts: contactsPerCompany.get(c.id) ?? 0,
      nb_deals: dealsPerCompany.get(c.id) ?? 0,
    })),
    contacts: raw.contacts.map((c) => ({
      ...c,
      tags: c.tags ?? [],
      email_jsonb: c.email_jsonb ?? [],
      phone_jsonb: c.phone_jsonb ?? [],
      status: latestStatus.get(c.id) ?? c.status ?? "cold",
      company_name:
        c.company_id != null ? companyNames.get(c.company_id) : undefined,
      nb_tasks: openTasksPerContact.get(c.id) ?? 0,
    })),
    contact_notes: raw.contact_notes,
    deals: raw.deals.map((d) => {
      const index = stageIndex.get(d.stage) ?? 0;
      stageIndex.set(d.stage, index + 1);
      return { ...d, contact_ids: d.contact_ids ?? [], index };
    }),
    deal_notes: raw.deal_notes,
    tasks: raw.tasks,
    configuration: [
      { id: 1, config: {} as Db["configuration"][number]["config"] },
    ],
  };
};
