"use client";

import { LockKeyhole, Mail, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

export function Profile() {
  const user = useTrafficStore((state) => state.user);
  const theme = useTrafficStore((state) => state.theme);
  const setTheme = useTrafficStore((state) => state.setTheme);
  if (!user) return <p className="py-12 text-center text-muted-foreground">Chưa có phiên đăng nhập.</p>;
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase();

  return <div className="space-y-6">
    <div className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tài khoản</p><h2 className="mt-1 text-2xl font-semibold">Hồ sơ và phiên đăng nhập</h2></div>
    <SectionCard title="Thông tin cá nhân" subtitle="Tài khoản đang sử dụng" icon={UserRound}>
      <div className="flex flex-wrap items-center gap-4 border-b border-border pb-5"><div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-lg font-semibold text-primary">{initials}</div><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold">{user.fullName}</h3><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{user.email}</p></div><StatusBadge color={user.role === "admin" ? "green" : "cyan"}>{user.role === "admin" ? "Quản trị viên" : "Vận hành viên"}</StatusBadge></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="Tên đăng nhập" value={user.username} /><Info label="Mã tài khoản" value={user.id} /><Info label="Phiên" value="Đã xác thực" /></div>
    </SectionCard>
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Giao diện" subtitle="Tùy chọn hiển thị trên thiết bị này" icon={theme === "dark" ? Moon : Sun}>
        <div className="flex flex-wrap gap-2"><button onClick={() => setTheme("dark")} aria-pressed={theme === "dark"} className={`rounded-lg border px-4 py-2 text-sm ${theme === "dark" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Moon className="mr-2 inline h-4 w-4" />Tối</button><button onClick={() => setTheme("light")} aria-pressed={theme === "light"} className={`rounded-lg border px-4 py-2 text-sm ${theme === "light" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Sun className="mr-2 inline h-4 w-4" />Sáng</button></div>
      </SectionCard>
      <SectionCard title="Bảo mật tài khoản" subtitle="Quản lý đăng nhập" icon={ShieldCheck}>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background/35 p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">Đăng nhập bằng phiên bảo mật</p><p className="mt-1 text-xs text-muted-foreground">Mật khẩu được xác minh ở máy chủ; website không lưu mật khẩu trong trình duyệt.</p></div></div>
        <p className="mt-3 text-xs text-muted-foreground">Đổi mật khẩu, xác thực hai bước và quản lý phiên khác chưa được kết nối trong ứng dụng.</p>
      </SectionCard>
    </div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border/80 bg-background/35 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1.5 break-all text-sm font-medium">{value}</p></div>; }
