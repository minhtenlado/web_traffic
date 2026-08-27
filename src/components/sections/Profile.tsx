"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Mail,
  Shield,
  CalendarDays,
  Clock,
  CheckCircle2,
  Activity,
  BellRing,
  Smartphone,
  Globe,
  Lock,
  KeyRound,
  Monitor,
  LogOut,
  Pencil,
  Moon,
  Sun,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { formatDate } from "@/lib/formatters";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

const MINI_STAT_COLORS: Record<string, string> = {
  primary: "text-primary bg-primary/10",
  green: "text-success bg-success/10",
  cyan: "text-chart-2 bg-chart-2/10",
  purple: "text-chart-5 bg-chart-5/10",
};

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: "primary" | "green" | "cyan" | "purple";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div
        className={cn(
          "mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl",
          MINI_STAT_COLORS[color] || MINI_STAT_COLORS.primary,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xl font-bold tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function Profile() {
  const user = useTrafficStore((s) => s.user);
  const theme = useTrafficStore((s) => s.theme);
  const setTheme = useTrafficStore((s) => s.setTheme);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Vui lòng đăng nhập để xem hồ sơ.
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Admin" : "Vận hành viên";

  const memberSince = formatDate(new Date("2024-01-15T00:00:00Z"));
  const lastLogin = formatDate(new Date(Date.now() - 3600000));

  const sessions = [
    {
      id: "s1",
      device: "Chrome — Windows",
      ip: "192.168.1.45",
      location: "Văn phòng Q1, TP.HCM",
      lastActive: "Đang hoạt động",
      current: true,
    },
    {
      id: "s2",
      device: "Safari — iPhone",
      ip: "203.113.140.12",
      location: "Quận Bình Thạnh, TP.HCM",
      lastActive: "2 giờ trước",
      current: false,
    },
  ];

  const handleEditProfile = () => {
    toast({
      title: "Chỉnh sửa hồ sơ",
      description: "Mở form chỉnh sửa thông tin cá nhân (mô phỏng).",
    });
  };

  const handleChangePassword = () => {
    setPasswordOpen(false);
    toast({
      title: "Đổi mật khẩu",
      description: "Mật khẩu đã được cập nhật thành công (mô phỏng).",
    });
  };

  const handleSignOutSession = (id: string) => {
    toast({
      title: "Đăng xuất phiên",
      description: `Phiên ${id} đã được đăng xuất (mô phỏng).`,
    });
  };

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="relative h-24 bg-gradient-to-r from-primary/25 via-chart-2/15 to-chart-5/15">
          <div className="animate-gradient absolute inset-0 bg-gradient-to-r from-primary/10 via-chart-2/10 to-chart-5/10 bg-[length:200%_200%]" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xl font-bold text-primary-foreground shadow-lg ring-4 ring-card">
                {initials(user.fullName)}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {user.fullName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
                    <Shield className="h-3 w-3" />
                    {roleLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  ID:{" "}
                  <span className="font-mono text-foreground/80">{user.id}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={handleEditProfile}>
              <Pencil className="h-3.5 w-3.5" />
              Chỉnh sửa hồ sơ
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Account info */}
      <SectionCard
        title="Thông tin tài khoản"
        subtitle="Chi tiết tài khoản đăng nhập"
        icon={UserIcon}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoTile icon={UserIcon} label="Tên đăng nhập" value={user.username} />
          <InfoTile icon={Mail} label="Email" value={user.email} />
          <InfoTile icon={Shield} label="Vai trò" value={roleLabel} />
          <InfoTile icon={CalendarDays} label="Tham gia từ" value={memberSince} />
          <InfoTile icon={Clock} label="Đăng nhập cuối" value={lastLogin} />
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Trạng thái
              </span>
            </div>
            <StatusBadge color="green" pulse>
              Hoạt động
            </StatusBadge>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Activity summary */}
        <SectionCard
          title="Tổng quan hoạt động"
          subtitle="7 ngày gần nhất"
          icon={Activity}
        >
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Activity} label="Hành động" value={42} color="primary" />
            <MiniStat
              icon={BellRing}
              label="Cảnh báo xử lý"
              value={8}
              color="cyan"
            />
            <MiniStat
              icon={Monitor}
              label="Phiên đăng nhập"
              value={2}
              color="purple"
            />
          </div>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Ghi chú:</span> Hoạt
            động chi tiết được ghi lại trong Nhật ký hoạt động hệ thống.
          </div>
        </SectionCard>

        {/* Preferences */}
        <SectionCard
          title="Tuỳ chọn cá nhân"
          subtitle="Giao diện và thông báo"
          icon={Settings2}
        >
          {/* Theme */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Giao diện</p>
                <p className="text-xs text-muted-foreground">
                  Đang dùng: {theme === "dark" ? "Tối" : "Sáng"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  theme === "light"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="h-3 w-3" /> Sáng
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  theme === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="h-3 w-3" /> Tối
              </button>
            </div>
          </div>

          {/* Notification prefs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-chart-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Thông báo email
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nhận cảnh báo qua email
                  </p>
                </div>
              </div>
              <Switch
                checked={emailNotif}
                onCheckedChange={setEmailNotif}
                aria-label="Thông báo email"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-chart-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Thông báo đẩy
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Push trên trình duyệt &amp; mobile
                  </p>
                </div>
              </div>
              <Switch
                checked={pushNotif}
                onCheckedChange={setPushNotif}
                aria-label="Thông báo đẩy"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <BellRing className="h-4 w-4 text-chart-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Thông báo trong ứng dụng
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hiển thị tại Dashboard
                  </p>
                </div>
              </div>
              <Switch
                checked={inAppNotif}
                onCheckedChange={setInAppNotif}
                aria-label="Thông báo trong ứng dụng"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-chart-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">Ngôn ngữ</p>
                  <p className="text-xs text-muted-foreground">
                    Hiển thị giao diện
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                Tiếng Việt
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Security */}
      <SectionCard
        title="Bảo mật &amp; Phiên đăng nhập"
        subtitle="Quản lý mật khẩu và phiên hoạt động"
        icon={Lock}
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: password + 2FA */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Mật khẩu</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Đổi mật khẩu định kỳ để bảo mật tài khoản.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setPasswordOpen(true)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Đổi mật khẩu
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Xác thực 2 bước
                  </p>
                </div>
                <Switch
                  checked={twoFA}
                  onCheckedChange={setTwoFA}
                  aria-label="Xác thực 2 bước"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Trạng thái:{" "}
                <span
                  className={
                    twoFA
                      ? "font-semibold text-success"
                      : "font-semibold text-warning"
                  }
                >
                  {twoFA ? "Đang bật" : "Chưa bật"}
                </span>
              </p>
            </div>
          </div>

          {/* Right: sessions */}
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phiên đăng nhập hoạt động
            </p>
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        s.current
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {s.device}
                        </p>
                        {s.current && (
                          <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                            HIỆN TẠI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.ip} · {s.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-xs",
                        s.current
                          ? "font-medium text-success"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.lastActive}
                    </span>
                    {!s.current && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSignOutSession(s.id)}
                        aria-label={`Đăng xuất phiên ${s.id}`}
                      >
                        <LogOut className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Change password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Mật khẩu hiện tại</Label>
              <Input id="cur-pw" type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">Mật khẩu mới</Label>
              <Input id="new-pw" type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
              <Input id="confirm-pw" type="password" placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleChangePassword}>Cập nhật mật khẩu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
