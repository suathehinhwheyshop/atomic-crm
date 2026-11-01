import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BarChart3,
  Landmark,
  Package,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useMemo } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { FilterBar } from "./components/FilterBar";
import { FiltersProvider } from "./components/FiltersContext";
import { SectionTabs } from "./components/SectionTabs";
import { useScopedData } from "./components/useScopedData";
import { REFRESH_INTERVAL_MS, useDataset } from "./data/useDataset";
import { buildAlerts } from "./model/metrics";
import { AlertsPage } from "./pages/AlertsPage";
import { CashbookPage } from "./pages/CashbookPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ChannelsPage } from "./pages/finance/ChannelsPage";
import { DebtsPage } from "./pages/finance/DebtsPage";
import { ExpensesPage } from "./pages/finance/ExpensesPage";
import { FundsPage } from "./pages/finance/FundsPage";
import { RevenuePage } from "./pages/finance/RevenuePage";
import { StatementPage } from "./pages/finance/StatementPage";
import { CatalogPage } from "./pages/goods/CatalogPage";
import { InventoryPage } from "./pages/goods/InventoryPage";
import { VolumePage } from "./pages/goods/VolumePage";
import { OrdersPage } from "./pages/OrdersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ShiftsPage } from "./pages/ShiftsPage";

const queryClient = new QueryClient();

const SECTIONS = [
  { to: "/", label: "Tổng quan", icon: BarChart3 },
  { to: "/finance", label: "Tài chính", icon: Landmark },
  { to: "/ops", label: "Kênh bán & Vận hành", icon: Workflow },
  { to: "/goods", label: "Hàng hóa", icon: Package },
];

const GOODS_TABS = [
  { to: "/goods/volume", label: "Số lượng bán ra" },
  { to: "/goods/inventory", label: "Tồn kho" },
  { to: "/goods/catalog", label: "Danh mục sản phẩm" },
];
const FINANCE_TABS = [
  { to: "/finance/statement", label: "Báo cáo gộp" },
  { to: "/finance/funds", label: "Sổ quỹ" },
  { to: "/finance/debts", label: "Công nợ NCC" },
  { to: "/finance/channels", label: "Kênh bán" },
  { to: "/finance/revenue", label: "Doanh thu" },
  { to: "/finance/expenses", label: "Chi phí" },
];
const OPS_TABS = [
  { to: "/ops/orders", label: "Đơn hàng" },
  { to: "/ops/customers", label: "Khách hàng" },
  { to: "/ops/cashbook", label: "Sổ quỹ & Chi phí" },
  { to: "/ops/shifts", label: "Ca & Nhân viên" },
  { to: "/ops/alerts", label: "Cần xử lý" },
];

const AlertCount = () => {
  const { loaded, scoped } = useScopedData();
  const count = useMemo(
    () => (scoped && loaded ? buildAlerts(scoped, loaded.today).length : 0),
    [scoped, loaded],
  );
  return count ? (
    <Badge variant="destructive" className="ml-auto">
      {count}
    </Badge>
  ) : null;
};

const SectionLink = ({
  to,
  label,
  icon: Icon,
  compact,
}: (typeof SECTIONS)[number] & { compact?: boolean }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      compact
        ? `shrink-0 rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-primary text-primary-foreground" : ""}`
        : `flex items-center gap-2 rounded-md px-2 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
    }
  >
    {compact ? null : <Icon className="size-4" />} {label}
    {to === "/ops" && !compact ? <AlertCount /> : null}
  </NavLink>
);

const Shell = () => {
  const { data, isFetching, refetch, error } = useDataset();
  if (!data) return null;
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r bg-background p-3 md:flex">
        <div className="px-2 py-3">
          <div className="text-lg font-bold">WheyShop</div>
          <div className="text-xs text-muted-foreground">
            Báo cáo bán hàng & tài chính
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <SectionLink key={s.to} {...s} />
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-xs text-muted-foreground">
          {data.mode === "demo" ? (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600"
            >
              Dữ liệu DEMO
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-500 text-emerald-600"
            >
              Đang nối Google Sheets
            </Badge>
          )}
          {error ? (
            <div className="text-destructive">
              Lỗi cập nhật, đang hiện số liệu lần trước: {error.message}
            </div>
          ) : null}
          <div>
            Cập nhật {data.fetchedAt.toLocaleTimeString("vi-VN")} · tự làm mới
            mỗi {REFRESH_INTERVAL_MS / 60_000} phút
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "animate-spin" : ""} /> Làm mới
          </Button>
          {data.mode === "live" ? (
            <a href="auth/logout" className="block text-center hover:underline">
              Đăng xuất
            </a>
          ) : null}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="flex gap-1 overflow-x-auto border-b bg-background p-2 md:hidden">
          {SECTIONS.map((s) => (
            <SectionLink key={s.to} {...s} compact />
          ))}
        </nav>
        <FilterBar
          today={data.today}
          connectedBranches={data.connectedBranches}
        />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route
              path="/goods"
              element={
                <SectionTabs
                  title="Hàng hóa (chờ Danh mục sản phẩm)"
                  tabs={GOODS_TABS}
                />
              }
            >
              <Route index element={<Navigate to="/goods/volume" replace />} />
              <Route path="volume" element={<VolumePage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="catalog" element={<CatalogPage />} />
            </Route>
            <Route
              path="/finance"
              element={<SectionTabs title="Tài chính" tabs={FINANCE_TABS} />}
            >
              <Route
                index
                element={<Navigate to="/finance/statement" replace />}
              />
              <Route path="channels" element={<ChannelsPage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="funds" element={<FundsPage />} />
              <Route path="debts" element={<DebtsPage />} />
              <Route path="statement" element={<StatementPage />} />
            </Route>
            <Route
              path="/ops"
              element={
                <SectionTabs title="Kênh bán & Vận hành" tabs={OPS_TABS} />
              }
            >
              <Route index element={<Navigate to="/ops/orders" replace />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="cashbook" element={<CashbookPage />} />
              <Route path="shifts" element={<ShiftsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const Root = () => {
  const { data, isPending, error, refetch } = useDataset();
  if (!data && error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium text-destructive">{error.message}</p>
        <p className="text-sm text-muted-foreground">
          Kiểm tra file key, quyền chia sẻ Sheet cho service account và mã Sheet
          trong ops-sources.json.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (isPending || !data) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> Đang tải dữ liệu…
      </div>
    );
  }
  return (
    <FiltersProvider
      initial={{
        branch: "ALL",
        line: "ALL",
        from: `${data.today.slice(0, 7)}-01`,
        to: data.today,
      }}
    >
      <HashRouter>
        <Shell />
      </HashRouter>
    </FiltersProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Root />
  </QueryClientProvider>
);

export default App;
