import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  createDataProvider,
} from "@/components/atomic-crm/providers/fakerest";
import { USER_STORAGE_KEY } from "@/components/atomic-crm/providers/fakerest/authProvider";
import { memoryStore } from "ra-core";

import companies from "../data/companies.json";
import contactNotes from "../data/contact_notes.json";
import contacts from "../data/contacts.json";
import dealNotes from "../data/deal_notes.json";
import deals from "../data/deals.json";
import sales from "../data/sales.json";
import tags from "../data/tags.json";
import tasks from "../data/tasks.json";
import { buildDb, type RawDb } from "./buildDb";
import {
  companySectors,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  noteStatuses,
  taskTypes,
} from "./config";

const db = buildDb({
  companies,
  contact_notes: contactNotes,
  contacts,
  deal_notes: dealNotes,
  deals,
  sales,
  tags,
  tasks,
} as unknown as RawDb);

// Log in as the first sales record of the JSON folder (the admin).
localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(db.sales[0]));

const dataProvider = createDataProvider({ db, authProvider });

const App = () => (
  <CRM
    dataProvider={dataProvider}
    authProvider={authProvider}
    store={memoryStore()}
    title="WheyShop CRM"
    currency="VND"
    companySectors={companySectors}
    dealStages={dealStages}
    dealPipelineStatuses={dealPipelineStatuses}
    dealCategories={dealCategories}
    noteStatuses={noteStatuses}
    taskTypes={taskTypes}
  />
);

export default App;
