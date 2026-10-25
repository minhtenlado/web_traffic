"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, RefreshCw, Server, Settings2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { DeviceManagement } from "./DeviceManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";

type ConfiguredUser = {
  id: string; username: string; fullName: string; email: string;
  role: "admin" | "operator"; status: "enabled"; lastLoginAt: number | null;
};
const emptyAccountForm = { fullName: "", username: "", email: "", password: "", passwordConfirm: "" };
const inputClass = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Admin() {
  const user = useTrafficStore((state) => state.user);
  const aiCount = CAMERAS.filter((camera) => camera.aiInput).length;
  const [accounts, setAccounts] = useState<ConfiguredUser[]>([]);
  const [accountState, setAccountState] = useState<"loading" | "ready" | "error">("loading");
  const [accountError, setAccountError] = useState("");
  const [loginHistoryAvailable, setLoginHistoryAvailable] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<"idle" | "saving">("idle");
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const refreshAccounts = async () => {
    setAccountState("loading"); setAccountError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải được danh sách tài khoản");
      setAccounts(Array.isArray(data.users) ? data.users : []);
      setLoginHistoryAvailable(data.loginHistoryAvailable !== false);
      setAccountState("ready");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Không tải được danh sách tài khoản");
      setAccountState("error");
    }
  };
  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(""); setCreateMessage("");
    if (accountForm.password !== accountForm.passwordConfirm) {
      setCreateError("Mật khẩu xác nhận không khớp"); return;
    }
    setCreateState("saving");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tạo được tài khoản");
      setCreateMessage(`Đã tạo tài khoản @${data.user.username} với quyền Vận hành viên. Hãy gửi mật khẩu ban đầu cho người dùng qua kênh riêng.`);
      setAccountForm(emptyAccountForm);
      setCreateOpen(false);
      void refreshAccounts();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Không tạo được tài khoản");
    } finally {
      setCreateState("idle");
    }
  };
  useEffect(() => { void refreshAccounts(); }, []);
  return <div className="space-y-6">
    <div className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</p><h2 className="mt-1 text-2xl font-semibold">Tài khoản, thiết bị và vận hành</h2><p className="mt-1 text-sm text-muted-foreground">Tài khoản lưu phía máy chủ; thiết bị lấy từ telemetry đang nhận.</p></div>
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="mb-4 h-auto flex-wrap bg-muted/60 p-1">
        <TabsTrigger value="account" className="gap-2"><Users className="h-4 w-4" />Tài khoản</TabsTrigger>
        <TabsTrigger value="devices" className="gap-2"><Server className="h-4 w-4" />Thiết bị</TabsTrigger>
        <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4" />Vận hành</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <SectionCard title="Tài khoản được cấp quyền" subtitle="Tài khoản lưu phía máy chủ; mật khẩu không hiển thị trong danh sách" icon={ShieldCheck}
          action={<div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { setCreateOpen((open) => !open); setCreateError(""); setCreateMessage(""); }}><UserPlus className="h-3.5 w-3.5" />Tạo vận hành viên</Button><Button size="sm" variant="outline" onClick={() => void refreshAccounts()} disabled={accountState === "loading"}><RefreshCw className="h-3.5 w-3.5" />Làm mới</Button></div>}>
          {createMessage && <p className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary" role="status">{createMessage}</p>}
          {createOpen && <form onSubmit={createAccount} className="mb-5 space-y-4 rounded-lg border border-border bg-background/35 p-4">
            <div><h3 className="font-medium">Tạo tài khoản vận hành viên</h3><p className="mt-1 text-xs text-muted-foreground">Tài khoản được lưu vào Firebase và có hiệu lực ngay sau khi tạo. Mật khẩu tối thiểu 12 ký tự.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">Họ và tên<input className={inputClass} autoComplete="name" maxLength={100} required value={accountForm.fullName} onChange={(event) => setAccountForm({ ...accountForm, fullName: event.target.value })} /></label>
              <label className="text-sm">Tên đăng nhập<input className={inputClass} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required value={accountForm.username} onChange={(event) => setAccountForm({ ...accountForm, username: event.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">3–32 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.</span></label>
              <label className="text-sm">Email (không bắt buộc)<input className={inputClass} autoComplete="email" maxLength={254} type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} /></label>
              <label className="text-sm">Mật khẩu ban đầu<input className={inputClass} autoComplete="new-password" minLength={12} maxLength={128} required type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} /></label>
              <label className="text-sm sm:col-span-2">Nhập lại mật khẩu<input className={inputClass} autoComplete="new-password" minLength={12} maxLength={128} required type="password" value={accountForm.passwordConfirm} onChange={(event) => setAccountForm({ ...accountForm, passwordConfirm: event.target.value })} /></label>
            </div>
            {createError && <p className="text-sm text-destructive" role="alert">{createError}</p>}
            <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={createState === "saving"}>{createState === "saving" ? "Đang lưu…" : "Tạo tài khoản"}</Button><Button type="button" variant="outline" disabled={createState === "saving"} onClick={() => { setCreateOpen(false); setAccountForm(emptyAccountForm); setCreateError(""); }}>Hủy</Button><span className="text-xs text-muted-foreground">Quyền được cấp: Vận hành viên</span></div>
          </form>}
          {accountState === "loading" ? <p className="py-6 text-center text-sm text-muted-foreground">Đang đọc cấu hình tài khoản…</p> :
            accountState === "error" ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{accountError}</div> :
              accounts.length ? <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Tài khoản</th><th className="p-3">Email</th><th className="p-3">Quyền</th><th className="p-3">Trạng thái</th><th className="p-3">Đăng nhập gần nhất</th></tr></thead>
                <tbody>{accounts.map((account) => <tr key={account.id} className="border-t border-border">
                  <td className="p-3"><p className="font-medium">{account.fullName || account.username}</p><p className="text-xs text-muted-foreground">@{account.username}</p></td>
                  <td className="p-3 text-muted-foreground">{account.email || "—"}</td>
                  <td className="p-3">{account.role === "admin" ? "Quản trị viên" : "Vận hành viên"}</td>
                  <td className="p-3"><StatusBadge color="green">Được cấp quyền</StatusBadge></td>
                  <td className="p-3 text-xs text-muted-foreground">{account.lastLoginAt ? formatDateTime(new Date(account.lastLoginAt).toISOString()) : loginHistoryAvailable ? "Chưa ghi nhận" : "Không đọc được nhật ký"}</td>
                </tr>)}</tbody>
              </table></div> : <p className="py-6 text-center text-sm text-muted-foreground">Máy chủ chưa cấu hình tài khoản.</p>}
          {user && <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Phiên hiện tại" value={`${user.fullName} · ${user.username}`} /><Info label="Quyền hiện tại" value={user.role === "admin" ? "Quản trị viên" : "Vận hành viên"} /></div>}
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-background/35 p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">Tài khoản mới có quyền Vận hành viên</p><p className="mt-1 text-xs text-muted-foreground">Mật khẩu được băm bằng scrypt trước khi lưu. Việc tạo tài khoản được ghi vào nhật ký hoạt động; không gửi mật khẩu qua email.</p></div><StatusBadge color="green">Lưu trên máy chủ</StatusBadge></div>
        </SectionCard>
      </TabsContent>
      <TabsContent value="devices"><DeviceManagement /></TabsContent>
      <TabsContent value="config">
        <SectionCard title="Thiết lập vận hành hiện tại" subtitle="Các giá trị bên dưới phản ánh cấu hình ứng dụng; không phải biểu mẫu lưu giả" icon={Settings2}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Khu vực" value="Ngã tư Hàng Xanh, TP. Hồ Chí Minh" />
            <Info label="Múi giờ hiển thị" value="Asia/Ho_Chi_Minh (UTC+7)" />
            <Info label="Nguồn trạng thái" value="Firebase Realtime Database" />
            <Info label="Cập nhật dự phòng" value="Mỗi 8 giây" />
            <Info label="Camera" value={`${CAMERAS.length} camera · ${aiCount} camera phân tích AI`} />
            <Info label="Triển khai model" value="Thủ công sau kiểm định và phê duyệt" />
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Thay đổi cấu hình hệ thống hoặc checkpoint cần được thực hiện qua quy trình triển khai có kiểm thử.</p>
        </SectionCard>
      </TabsContent>
    </Tabs>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/80 bg-background/35 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1.5 text-sm font-medium">{value}</p></div>;
}
