// Product catalog ("Danh mục sản phẩm" tab): one canonical product per row with
// the alternative names typed in the sales tabs, so every file maps to the same
// product code. Matching is done here, in the app, never in the sheets.
import { parseAmount, readTable } from "./sheet";
import type { Dataset, Order, OrderItem, WorkbookSource } from "./types";

export type Product = {
  code: string;
  name: string;
  brand: string;
  group: string;
  spec: string;
  unit: string;
  costPrice: number;
  aliases: string[];
};

/** Lowercase, collapse spaces and punctuation, keep Vietnamese letters. */
export const normalizeName = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[®™()[\],.:;/\\\-–—_+*"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parseCatalog = (values: string[][] | undefined): Product[] => {
  const table = readTable(values);
  return table.rows.flatMap((row) => {
    const code = table.get(row, "Mã SP");
    const name = table.get(row, "Tên chuẩn");
    if (!code || !name) return [];
    return [
      {
        code,
        name,
        brand: table.get(row, "Thương hiệu"),
        group: table.get(row, "Nhóm"),
        spec: table.get(row, "Quy cách"),
        unit: table.get(row, "Đơn vị") || "hộp",
        costPrice: parseAmount(table.get(row, "Giá vốn")),
        aliases: table
          .get(row, "Tên khác")
          .split(";")
          .map((a) => a.trim())
          .filter(Boolean),
      },
    ];
  });
};

export const findCatalogTab = (source: WorkbookSource) =>
  Object.entries(source.tabs).find(([title]) =>
    title.startsWith("Danh mục sản phẩm"),
  )?.[1];

/** Union of catalogs from every workbook, first definition of a code wins. */
export const mergeCatalogs = (catalogs: Product[][]): Product[] => {
  const byCode = new Map<string, Product>();
  catalogs.flat().forEach((p) => {
    if (!byCode.has(p.code)) byCode.set(p.code, p);
  });
  return [...byCode.values()];
};

type Matcher = (name: string) => Product | null;

/**
 * Exact match on the canonical name or an alias first; otherwise the product whose
 * longest alias has all its words inside the typed name ("whey isolate 2kg" matches
 * "BioX Whey Isolate 2kg socola"). Short aliases (< 2 words and < 6 chars) never
 * fuzzy-match, to avoid "bình" matching everything.
 */
export const createMatcher = (catalog: Product[]): Matcher => {
  const exact = new Map<string, Product>();
  const fuzzy: Array<{ tokens: string[]; length: number; product: Product }> =
    [];
  catalog.forEach((product) => {
    [product.name, ...product.aliases].forEach((alias) => {
      const key = normalizeName(alias);
      if (!key) return;
      if (!exact.has(key)) exact.set(key, product);
      const tokens = key.split(" ");
      if (tokens.length >= 2 || key.length >= 6)
        fuzzy.push({ tokens, length: key.length, product });
    });
  });
  fuzzy.sort((a, b) => b.length - a.length);
  const cache = new Map<string, Product | null>();
  return (name) => {
    const key = normalizeName(name);
    if (!key) return null;
    if (cache.has(key)) return cache.get(key)!;
    const padded = ` ${key} `;
    const hit =
      exact.get(key) ??
      fuzzy.find((f) => f.tokens.every((t) => padded.includes(` ${t} `)))
        ?.product ??
      null;
    cache.set(key, hit);
    return hit;
  };
};

const applyToItem = (item: OrderItem, match: Matcher): OrderItem => {
  const product = match(item.product);
  return product
    ? {
        ...item,
        productCode: product.code,
        canonicalName: product.name,
        costPrice: product.costPrice,
      }
    : item;
};

const applyToOrder = (order: Order, match: Matcher): Order => ({
  ...order,
  items: order.items.map((i) => applyToItem(i, match)),
});

/** Annotate every order item and stock row with its catalog product. */
export const applyCatalog = (data: Dataset): Dataset => {
  const match = createMatcher(data.catalog);
  return {
    ...data,
    orders: data.orders.map((o) => applyToOrder(o, match)),
    inventory: data.inventory.map((i) => {
      const product =
        data.catalog.find((p) => p.code === i.productCode) ?? match(i.product);
      return product
        ? {
            ...i,
            productCode: product.code,
            product: product.name,
            costPrice: i.costPrice || product.costPrice,
            unit: i.unit || product.unit,
          }
        : i;
    }),
  };
};

export type UnmatchedName = {
  name: string;
  quantity: number;
  branches: string[];
  sample: string;
};

/** Typed product names that no catalog row covers, most sold first. */
export const unmatchedNames = (orders: Order[]): UnmatchedName[] => {
  const map = new Map<string, UnmatchedName>();
  orders.forEach((o) =>
    o.items
      .filter((i) => i.product && !i.productCode && i.unitPrice > 0)
      .forEach((i) => {
        const key = normalizeName(i.product);
        const row = map.get(key) ?? {
          name: i.product,
          quantity: 0,
          branches: [],
          sample: o.code,
        };
        map.set(key, {
          ...row,
          quantity: row.quantity + i.quantity,
          branches: row.branches.includes(o.branch)
            ? row.branches
            : [...row.branches, o.branch],
        });
      }),
  );
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
};
