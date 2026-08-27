"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  ShieldCheck,
  UserCog,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Settings2,
  Clock,
  Save,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { timeAgo } from "@/lib/formatters";
import { StatCard, SectionCard, StatusBadge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

function roleBadge(role: string) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Admin
      </span>
    );
  }
  return <StatusBadge color="cyan">Vận hành viên</StatusBadge>;
}

export function Admin() {
  const users = useTrafficStore((s) => s.users);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // System config state (local mock)
  const [intersectionName, setIntersectionName] = useState("Ngã tư Hàng Xanh");
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [autoUpdateModel, setAutoUpdateModel] = useState(true);
  const [alertNotifications, setAlertNotifications] = useState(true);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const operators = users.filter((u) => u.role === "operator").length;
    return { total, active, admins, operators };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleAddUser = () => {
    setDialogOpen(false);
    toast({
      title: "Tạo người dùng mới",
      description: "Tài khoản đã được tạo thành công (mô phỏng).",
    });
  };

  const handleEdit = (name: string) => {
    toast({
      title: "Chỉnh sửa người dùng",
      description: `Mở form chỉnh sửa cho ${name} (mô phỏng).`,
    });
  };

  const handleDelete = (name: string) => {
    toast({
      title: "Xoá người dùng",
      description: `Đã gửi yêu cầu xoá tài khoản ${name} (mô phỏng).`,
    });
  };

  const handleSaveConfig = () => {
    toast({
      title: "Lưu cấu hình hệ thống",
      description: "Cấu hình đã được cập nhật thành công.",
    });
  };

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Tổng người dùng"
          value={stats.total}
          unit="tài khoản"
          trend="neutral"
          trendValue="toàn hệ thống"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={UserCheck}
          label="Đang hoạt động"
          value={stats.active}
          unit="tài khoản"
          trend="up"
          trendValue="online"
          color="green"
          delay={0.05}
        />
        <StatCard
          icon={ShieldCheck}
          label="Quản trị viên"
          value={stats.admins}
          unit="người"
          trend="neutral"
          trendValue="toàn quyền"
          color="purple"
          delay={0.1}
        />
        <StatCard
          icon={UserCog}
          label="Vận hành viên"
          value={stats.operators}
          unit="người"
          trend="neutral"
          trendValue="vận hành"
          color="cyan"
          delay={0.15}
        />
      </div>

      {/* User management */}
      <SectionCard
        title="Quản lý người dùng"
        subtitle="Danh sách tài khoản và phân quyền"
        icon={Users}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-3.5 w-3.5" />
                Thêm người dùng
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm người dùng mới</DialogTitle>
                <DialogDescription>
                  Tạo tài khoản mới cho hệ thống giám sát giao thông.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-name">Họ và tên</Label>
                  <Input id="new-name" placeholder="VD: Nguyễn Văn A" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="email@gtvt.gov.vn"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-role">Vai trò</Label>
                    <Select defaultValue="operator">
                      <SelectTrigger id="new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="operator">Vận hành viên</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-status">Trạng thái</Label>
                    <Select defaultValue="active">
                      <SelectTrigger id="new-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Hoạt động</SelectItem>
                        <SelectItem value="inactive">Tạm khoá</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Huỷ
                </Button>
                <Button onClick={handleAddUser}>Tạo tài khoản</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border [&>[data-slot=table-container]]:max-h-[520px] [&>[data-slot=table-container]]:overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đăng nhập cuối</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Không tìm thấy người dùng phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4) }}
                    className="border-b border-border transition-colors hover:bg-primary/5"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 text-xs font-bold text-primary">
                          {initials(u.name)}
                        </div>
                        <span className="font-medium text-foreground">
                          {u.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>
                      {u.status === "active" ? (
                        <StatusBadge color="green">Hoạt động</StatusBadge>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          Tạm khoá
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {timeAgo(u.lastLogin)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(u.name)}
                          aria-label={`Chỉnh sửa ${u.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(u.name)}
                          aria-label={`Xoá ${u.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Tổng:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {filtered.length}
          </span>{" "}
          / {stats.total} tài khoản
        </div>
      </SectionCard>

      {/* System config */}
      <SectionCard
        title="Cấu hình hệ thống"
        subtitle="Thiết lập tham số vận hành"
        icon={Settings2}
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Intersection name */}
          <div className="space-y-2">
            <Label htmlFor="intersection-name">Tên ngã tư giám sát</Label>
            <Input
              id="intersection-name"
              value={intersectionName}
              onChange={(e) => setIntersectionName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tên hiển thị trên các báo cáo và bản đồ.
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Múi giờ hiển thị</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">
                Asia/Ho_Chi_Minh
              </span>
              <span className="text-muted-foreground">(UTC+7)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Múi giờ dùng cho mọi timestamp hiển thị.
            </p>
          </div>

          {/* Refresh interval */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Chu kỳ làm mới dữ liệu thời gian thực</Label>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {refreshInterval}s
              </span>
            </div>
            <Slider
              min={1}
              max={60}
              step={1}
              value={[refreshInterval]}
              onValueChange={(v) => setRefreshInterval(v[0] ?? 5)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1s</span>
              <span>30s</span>
              <span>60s</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
            <div className="pr-4">
              <p className="text-sm font-semibold text-foreground">
                Tự động cập nhật mô hình AI
              </p>
              <p className="text-xs text-muted-foreground">
                Tải mô hình mới khi có phiên bản ổn định.
              </p>
            </div>
            <Switch
              checked={autoUpdateModel}
              onCheckedChange={setAutoUpdateModel}
              aria-label="Tự động cập nhật mô hình AI"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
            <div className="pr-4">
              <p className="text-sm font-semibold text-foreground">
                Thông báo cảnh báo
              </p>
              <p className="text-xs text-muted-foreground">
                Gửi thông báo khi có cảnh báo quan trọng.
              </p>
            </div>
            <Switch
              checked={alertNotifications}
              onCheckedChange={setAlertNotifications}
              aria-label="Thông báo cảnh báo"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleSaveConfig}>
            <Save className="h-3.5 w-3.5" />
            Lưu cấu hình
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
