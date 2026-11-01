import { NavLink, Outlet } from "react-router";

export type SectionTab = { to: string; label: string };

/** Second-level tabs inside a section (Hàng hóa, Tài chính, Vận hành). */
export const SectionTabs = ({
  title,
  tabs,
}: {
  title: string;
  tabs: SectionTab[];
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-1 text-sm ${isActive ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
    <Outlet />
  </div>
);
