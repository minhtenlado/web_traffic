"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  BarChart3,
  TrafficCone,
  Brain,
  Bell,
  ClipboardList,
  Settings,
  ChevronLeft,
  Activity,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTrafficStore, type SectionId } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface NavItem {
  id: SectionId;
  icon: LucideIcon;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Tổng quan" },
  { id: "camera", icon: Video, label: "Giám sát Camera" },
  { id: "analytics", icon: BarChart3, label: "Thống kê" },
  { id: "signal", icon: TrafficCone, label: "Điều khiển đèn" },
  { id: "model", icon: Brain, label: "Mô hình AI" },
  { id: "alerts", icon: Bell, label: "Cảnh báo" },
  { id: "audit", icon: ClipboardList, label: "Nhật ký", adminOnly: true },
  { id: "admin", icon: Settings, label: "Quản trị", adminOnly: true },
  { id: "health", icon: Activity, label: "Hệ thống", adminOnly: true },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const activeSection = useTrafficStore((s) => s.activeSection);
  const setActive = useTrafficStore((s) => s.setActiveSection);
  const alertCount = useTrafficStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const user = useTrafficStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActive(item.id);
                onNavigate?.();
              }}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive ? "text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                  isActive && "text-primary",
                )}
                strokeWidth={2}
              />
              <span className="relative flex-1 text-left">{item.label}</span>
              {item.id === "alerts" && alertCount > 0 && (
                <motion.span
                  key={alertCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                >
                  {alertCount > 9 ? "9+" : alertCount}
                </motion.span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => {
            setActive("profile");
            onNavigate?.();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/60",
            activeSection === "profile" && "bg-accent",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-bold text-primary-foreground">
            {user?.fullName?.charAt(0) || <User className="h-4 w-4" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-xs font-semibold text-foreground">
              {user?.fullName || "Người dùng"}
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {isAdmin ? "Admin" : "Vận hành viên"}
            </span>
          </div>
        </button>
      </div>
    </>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 px-4">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-chart-2 shadow-lg shadow-primary/30">
        <TrafficCone className="relative h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
        <div className="absolute inset-0 animate-gradient bg-gradient-to-br from-primary/40 to-chart-2/40" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight text-foreground">Giao Thông AI</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Hàng Xanh
        </span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const open = useTrafficStore((s) => s.sidebarOpen);
  const toggle = useTrafficStore((s) => s.toggleSidebar);
  const isMobile = useIsMobile();

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggle}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl"
            >
              <div className="relative">
                <Brand />
                <button
                  onClick={toggle}
                  aria-label="Đóng menu"
                  className="absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavContent onNavigate={toggle} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: inline animated sidebar
  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 264 : 76 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="relative z-30 flex h-full flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl"
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-chart-2 shadow-lg shadow-primary/30">
          <TrafficCone className="relative h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
          <div className="absolute inset-0 animate-gradient bg-gradient-to-br from-primary/40 to-chart-2/40" />
        </div>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col leading-tight"
          >
            <span className="text-sm font-semibold tracking-tight text-foreground">Giao Thông AI</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Hàng Xanh
            </span>
          </motion.div>
        )}
      </div>

      <button
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="absolute -right-3 top-20 z-40 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-accent-foreground lg:flex"
      >
        <motion.div animate={{ rotate: open ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </motion.div>
      </button>

      <DesktopNav />
    </motion.aside>
  );
}

function DesktopNav() {
  const open = useTrafficStore((s) => s.sidebarOpen);
  const activeSection = useTrafficStore((s) => s.activeSection);
  const setActive = useTrafficStore((s) => s.setActiveSection);
  const alertCount = useTrafficStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const user = useTrafficStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                !open && "justify-center",
                isActive ? "text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
              title={!open ? item.label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-desktop"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bar-desktop"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                  isActive && "text-primary",
                )}
                strokeWidth={2}
              />
              {open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative flex-1 text-left"
                >
                  {item.label}
                </motion.span>
              )}
              {open && item.id === "alerts" && alertCount > 0 && (
                <motion.span
                  key={alertCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                >
                  {alertCount > 9 ? "9+" : alertCount}
                </motion.span>
              )}
              {!open && item.id === "alerts" && alertCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => setActive("profile")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/60",
            !open && "justify-center",
            activeSection === "profile" && "bg-accent",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-bold text-primary-foreground">
            {user?.fullName?.charAt(0) || <User className="h-4 w-4" />}
          </div>
          {open && (
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-xs font-semibold text-foreground">
                {user?.fullName || "Người dùng"}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                {isAdmin ? "Admin" : "Vận hành viên"}
              </span>
            </div>
          )}
        </button>
      </div>
    </>
  );
}
