"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Bell, Radio, MapPin, LogOut, Menu } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatLongDate, formatClockTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Tổng quan", subtitle: "Trung tâm điều khiển giao thông" },
  camera: { title: "Giám sát Camera", subtitle: "Theo dõi trực tiếp 7 camera" },
  analytics: { title: "Thống kê & Phân tích", subtitle: "Dữ liệu lưu lượng & dự báo AI" },
  signal: { title: "Điều khiển đèn", subtitle: "Quản lý pha đèn giao thông" },
  model: { title: "Mô hình AI", subtitle: "Quản lý & đánh giá mô hình" },
  alerts: { title: "Cảnh báo", subtitle: "Sự kiện & cảnh báo hệ thống" },
  audit: { title: "Nhật ký hoạt động", subtitle: "Lịch sử thao tác người dùng" },
  admin: { title: "Quản trị", subtitle: "Quản lý người dùng & cấu hình" },
  profile: { title: "Hồ sơ", subtitle: "Thông tin tài khoản" },
  health: { title: "Giám sát Hệ thống", subtitle: "Trạng thái phần cứng & dịch vụ" },
};

export function Header() {
  const [time, setTime] = useState<Date | null>(null);
  const activeSection = useTrafficStore((s) => s.activeSection);
  const theme = useTrafficStore((s) => s.theme);
  const toggleTheme = useTrafficStore((s) => s.toggleTheme);
  const setActive = useTrafficStore((s) => s.setActiveSection);
  const alertCount = useTrafficStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const isBoardOffline = useTrafficStore((s) => s.isBoardOffline);
  const user = useTrafficStore((s) => s.user);
  const logout = useTrafficStore((s) => s.logout);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const toggleSidebar = useTrafficStore((s) => s.toggleSidebar);
  const isMobile = useIsMobile();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = SECTION_TITLES[activeSection] || SECTION_TITLES.dashboard;
  const onlineCameras = realtimeCams
    ? Object.values(realtimeCams).filter((c: any) => c.status === "ONLINE").length
    : 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-5">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex min-w-0 items-center gap-2">
        {isMobile && (
          <button
            onClick={toggleSidebar}
            aria-label="Mở menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2"
            >
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {meta.title}
              </h1>
            </motion.div>
          </AnimatePresence>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* System status */}
        <div
          className={cn(
            "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium md:flex",
            isBoardOffline
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success/10 text-success",
          )}
        >
          <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-current" />
          <Radio className="h-3.5 w-3.5" />
          <span>{isBoardOffline ? "Bo mạch offline" : `${onlineCameras}/7 camera online`}</span>
        </div>

        {/* Location */}
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground lg:flex">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>Ngã tư Hàng Xanh</span>
        </div>

        {/* Clock */}
        <div className="hidden flex-col items-end leading-tight sm:flex">
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {time ? formatClockTime(time) : "--:--:--"}
          </span>
          <span className="text-[10px] capitalize text-muted-foreground">
            {time ? formatLongDate(time) : ""}
          </span>
        </div>

        {/* Alerts */}
        <button
          onClick={() => setActive("alerts")}
          aria-label="Cảnh báo"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <motion.span
              key={alertCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-background"
            >
              {alertCount > 9 ? "9+" : alertCount}
            </motion.span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Đổi giao diện"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === "dark" ? (
              <motion.div key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Moon className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Sun className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* User + logout */}
        <div className="flex items-center gap-2 pl-1">
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="text-xs font-semibold text-foreground">{user?.fullName}</span>
            <span className="text-[10px] text-muted-foreground">
              {user?.role === "admin" ? "Quản trị viên" : "Vận hành viên"}
            </span>
          </div>
          <button
            onClick={logout}
            aria-label="Đăng xuất"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
