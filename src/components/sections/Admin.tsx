"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, RefreshCw, Server, Settings2, ShieldCheck, Users } from "lucide-react";
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

export function Admin() {
  const user = useTrafficStore((state) => state.user);
  const aiCount = CAMERAS.filter((camera) => camera.aiInput).length;
  const [accounts, setAccounts] = useState<ConfiguredUser[]>([]);
  const [accountState, setAccountState] = useState<"loading" | "ready" | "error">("loading");
  const [accountError, setAccountError] = useState("");
  const [loginHistoryAvailable, setLoginHistoryAvailable] = useState(true);
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
  useEffect(() => { void refreshAccounts(); }, []);
  return <div className="space-y-6">
    <div className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</p><h2 className="mt-1 text-2xl font-semibold">Tài khoản, thiết bị và vận hành</h2><p className="mt-1 text-sm text-muted-foreground">Danh sách tài khoản lấy từ cấu hình xác thực máy chủ; thiết bị lấy từ telemetry đang nhận.</p></div>
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="mb-4 h-auto flex-wrap bg-muted/60 p-1">
        <TabsTrigger value="account" className="gap-2"><Users className="h-4 w-4" />Tài khoản</TabsTrigger>
        <TabsTrigger value="devices" className="gap-2"><Server className="h-4 w-4" />Thiết bị</TabsTrigger>
        <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4" />Vận hành</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <SectionCard title="Tài khoản được cấp quyền" subtitle="Đọc từ cấu hình đăng nhập đang chạy trên máy chủ · không hiển thị thông tin xác thực" icon={ShieldCheck}
          action={<Button size="sm" variant="outline" onClick={() => void refreshAccounts()} disabled={accountState === "loading"}><RefreshCw className="h-3.5 w-3.5" />Làm mới</Button>}>
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
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="text-sm font-medium">Quản lý tài khoản qua cấu hình xác thực máy chủ</p><p className="mt-1 text-xs text-muted-foreground">Danh sách này phản ánh tài khoản có thể đăng nhập. Việc thêm, xóa hoặc đổi quyền cần cập nhật cấu hình bí mật và triển khai; không ghi thay đổi giả vào trình duyệt.</p></div><StatusBadge color="amber">Nguồn máy chủ</StatusBadge></div>
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
