import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  RefreshCw,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { FilterBar } from "./components/FilterBar";
import { FiltersProvider } from "./components/FiltersContext";
import { useScopedData } from "./components/useScopedData";
import { REFRESH_INTERVAL_MS, useDataset } from "./data/useDataset";
import { buildAlerts } from "./model/metrics";
import { AlertsPage } from "./pages/AlertsPage";
import { CashbookPage } from "./pages/CashbookPage";
import { CustomersPage } from "./pages/CustomersPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ShiftsPage } from "./pages/ShiftsPage";

const queryClient = new QueryClient();

const NAV = [
  { to: "/", label: "Tổng quan", icon: BarChart3, element: <OverviewPage /> },
  {
    to: "/orders",
    label: "Đơn hàng",
    icon: ShoppingCart,
    element: <OrdersPage />,
  },
  {
    to: "/customers",
    label: "Khách hàng",
    icon: Users,
    element: <CustomersPage />,
  },
  {
    to: "/cashbook",
    label: "Sổ quỹ & Chi phí",
    icon: Wallet,
    element: <CashbookPage />,
  },
  {
    to: "/shifts",
    label: "Ca & Nhân viên",
    icon: Clock,
    element: <ShiftsPage />,
  },
  {
    to: "/alerts",
    label: "Cần xử lý",
    icon: AlertTriangle,
    element: <AlertsPage />,
  },
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

const Shell = () => {
  const { data, isFetching, refetch, error } = useDataset();
  if (!data) return null;
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background p-3 md:flex">
        <div className="px-2 py-3">
          <div className="text-lg font-bold">WheyShop</div>
          <div className="text-xs text-muted-foreground">
            Quản lý bán hàng & khách hàng
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
              }
            >
              <Icon className="size-4" /> {label}
              {to === "/alerts" ? <AlertCount /> : null}
            </NavLink>
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
            mỗi {REFRESH_INTERVAL_MS / 1000}s
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
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="flex gap-1 overflow-x-auto border-b bg-background p-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `shrink-0 rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-primary text-primary-foreground" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <FilterBar
          today={data.today}
          connectedBranches={data.connectedBranches}
        />
        <main className="p-6">
          <Routes>
            {NAV.map(({ to, element }) => (
              <Route key={to} path={to} element={element} />
            ))}
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
