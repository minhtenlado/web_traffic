"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Bell, Radio, MapPin, LogOut, Menu, Clock3 } from "lucide-react";
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
  admin: { title: "Quản trị", subtitle: "Quản lý hệ thống" },
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
  const edgeAI = useTrafficStore((s) => s.edgeAI);
  const controllerStatus = useTrafficStore((s) => s.controllerStatus);
  const user = useTrafficStore((s) => s.user);
  const logout = useTrafficStore((s) => s.logout);
  const toggleSidebar = useTrafficStore((s) => s.toggleSidebar);
  const isMobile = useIsMobile();

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = SECTION_TITLES[activeSection] || SECTION_TITLES.dashboard;
  const nowSeconds = (time?.getTime() ?? Date.now()) / 1000;
  const edgeGeneratedAt = Number(edgeAI?.generated_at);
  const genioOnline = edgeAI?.status?.online === true && Number.isFinite(edgeGeneratedAt) &&
    nowSeconds >= edgeGeneratedAt && nowSeconds - edgeGeneratedAt <= 30;
  const controllerLastSeen = Number(controllerStatus?.lastSeen);
  const stm32Online = controllerStatus?.online === true && Number.isFinite(controllerLastSeen) &&
    nowSeconds >= controllerLastSeen - 2 && nowSeconds - controllerLastSeen < 3;

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-border bg-background/95 px-4 sm:px-6">
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
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
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
        <div className="hidden items-center gap-2 text-xs font-medium md:flex" aria-label="Trạng thái Genio và STM32">
          <span className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5",
            genioOnline ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
          )}>
            <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-current" />
            <Radio className="h-3.5 w-3.5" />
            <span>Genio {genioOnline ? "đang hoạt động" : "mất kết nối"}</span>
          </span>
          <span className={cn(
            "rounded-full border px-3 py-1.5",
            stm32Online ? "border-success/30 bg-success/10 text-success" : "border-amber-500/30 bg-amber-500/10 text-amber-600",
          )}>
            STM32 {stm32Online ? "đang phản hồi" : "chưa phản hồi"}
          </span>
        </div>

        <div className="hidden items-center gap-2 border-r border-border pr-3 text-right lg:flex">
          <MapPin className="h-4 w-4 text-primary" />
          <div className="leading-tight"><p className="text-xs font-semibold">Ngã tư Hàng Xanh</p><p className="text-[10px] text-muted-foreground">TP. Hồ Chí Minh</p></div>
        </div>

        {time && <div className="hidden min-w-[118px] flex-col items-end leading-tight xl:flex">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums"><Clock3 className="h-3.5 w-3.5 text-muted-foreground" />{formatClockTime(time)}</span>
          <span className="text-[10px] text-muted-foreground">{formatLongDate(time)}</span>
        </div>}

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
