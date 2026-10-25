"use client";

import { LockKeyhole, Server, Settings2, ShieldCheck, Users } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { DeviceManagement } from "./DeviceManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Admin() {
  const user = useTrafficStore((state) => state.user);
  const aiCount = CAMERAS.filter((camera) => camera.aiInput).length;
  return <div className="space-y-6">
    <div className="border-b border-border pb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</p><h2 className="mt-1 text-2xl font-semibold">Cấu hình và thiết bị</h2><p className="mt-1 text-sm text-muted-foreground">Thông tin thật về phiên truy cập và các kết nối đang được giám sát.</p></div>
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="mb-4 h-auto flex-wrap bg-muted/60 p-1">
        <TabsTrigger value="account" className="gap-2"><Users className="h-4 w-4" />Phiên truy cập</TabsTrigger>
        <TabsTrigger value="devices" className="gap-2"><Server className="h-4 w-4" />Thiết bị</TabsTrigger>
        <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4" />Vận hành</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <SectionCard title="Tài khoản hiện tại" subtitle="Thông tin lấy từ phiên đăng nhập đã xác thực" icon={ShieldCheck}>
          {user ? <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Họ tên" value={user.fullName} /><Info label="Email" value={user.email} /><Info label="Tên đăng nhập" value={user.username} /><Info label="Quyền" value={user.role === "admin" ? "Quản trị viên" : "Vận hành viên"} />
          </div> : <p className="text-sm text-muted-foreground">Không có thông tin phiên đăng nhập.</p>}
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="text-sm font-medium">Danh sách và chỉnh sửa tài khoản chưa được kết nối</p><p className="mt-1 text-xs text-muted-foreground">Tài khoản được cấu hình ở máy chủ. Giao diện này không tạo, sửa hoặc xóa tài khoản trong phiên trình duyệt.</p></div><StatusBadge color="amber">Chỉ đọc</StatusBadge></div>
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
