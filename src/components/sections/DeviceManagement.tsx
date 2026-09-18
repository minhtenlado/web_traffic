"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Server,
  Camera,
  MonitorPlay,
  Cpu,
  Wifi,
  WifiOff,
  AlertCircle,
  Search,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTrafficStore, type DeviceItem } from "@/lib/store";
import { timeAgo } from "@/lib/formatters";
import { StatCard, SectionCard, StatusBadge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const DEVICE_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  camera: { label: "Camera AI", icon: Camera, color: "text-primary" },
  controller: { label: "Tủ điều khiển", icon: Cpu, color: "text-purple-500" },
  display: { label: "Màn hình VMS", icon: MonitorPlay, color: "text-cyan-500" },
  sensor: { label: "Cảm biến", icon: Server, color: "text-warning" },
};

export function DeviceManagement() {
  const devices = useTrafficStore((s) => s.devices);
  const addDevice = useTrafficStore((s) => s.addDevice);
  const updateDevice = useTrafficStore((s) => s.updateDevice);
  const deleteDevice = useTrafficStore((s) => s.deleteDevice);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);
  const [viewDevice, setViewDevice] = useState<DeviceItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<DeviceItem>>({
    id: "",
    name: "",
    type: "camera",
    ip: "",
    location: "",
    status: "online",
  });

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const offline = devices.filter((d) => d.status === "offline").length;
    const error = devices.filter((d) => d.status === "error").length;
    return { total, online, offline, error };
  }, [devices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setFormData({
      id: `DEV-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      name: "",
      type: "camera",
      ip: "",
      location: "",
      status: "online",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (device: DeviceItem) => {
    setEditingDevice(device);
    setFormData({ ...device });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.ip) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ tên và địa chỉ IP.",
        variant: "destructive",
      });
      return;
    }

    if (editingDevice) {
      updateDevice(editingDevice.id, { ...formData, lastSeen: new Date().toISOString() } as Partial<DeviceItem>);
      toast({
        title: "Cập nhật thành công",
        description: `Đã cập nhật thông tin thiết bị ${formData.name}.`,
      });
    } else {
      addDevice({
        ...(formData as DeviceItem),
        lastSeen: new Date().toISOString(),
      });
      toast({
        title: "Thêm thành công",
        description: `Đã thêm thiết bị mới ${formData.name}.`,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa thiết bị ${name} không?`)) {
      deleteDevice(id);
      toast({
        title: "Xóa thành công",
        description: `Đã xóa thiết bị ${name}.`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Server}
          label="Tổng thiết bị"
          value={stats.total}
          unit="thiết bị"
          trend="neutral"
          trendValue="đã đăng ký"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={Wifi}
          label="Đang kết nối (Online)"
          value={stats.online}
          unit="thiết bị"
          trend="up"
          trendValue="hoạt động tốt"
          color="green"
          delay={0.05}
        />
        <StatCard
          icon={WifiOff}
          label="Mất kết nối (Offline)"
          value={stats.offline}
          unit="thiết bị"
          trend={stats.offline > 0 ? "up" : "neutral"}
          trendValue="cần kiểm tra"
          color="amber"
          delay={0.1}
        />
        <StatCard
          icon={AlertCircle}
          label="Đang báo lỗi"
          value={stats.error}
          unit="thiết bị"
          trend={stats.error > 0 ? "up" : "neutral"}
          trendValue="cần xử lý gấp"
          color="red"
          delay={0.15}
        />
      </div>

      {/* Device management */}
      <SectionCard
        title="Danh sách thiết bị"
        subtitle="Quản lý và theo dõi trạng thái các thiết bị ngoại vi"
        icon={Server}
        action={
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Thêm thiết bị
          </Button>
        }
      >
        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã, tên hoặc IP thiết bị..."
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
                <TableHead>Thiết bị</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>IP / Địa chỉ</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Cập nhật cuối</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <Server className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Không tìm thấy thiết bị phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d, i) => {
                  const typeInfo = DEVICE_TYPES[d.type] || DEVICE_TYPES.camera;
                  const Icon = typeInfo.icon;
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4) }}
                      className="border-b border-border transition-colors hover:bg-primary/5 cursor-pointer"
                      onClick={() => setViewDevice(d)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {d.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {d.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className={`h-3.5 w-3.5 ${typeInfo.color}`} />
                          <span className="text-sm font-medium">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {d.ip}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.location}
                      </TableCell>
                      <TableCell>
                        {d.status === "online" ? (
                          <StatusBadge color="green">Online</StatusBadge>
                        ) : d.status === "offline" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            Offline
                          </span>
                        ) : (
                          <StatusBadge color="red">Lỗi</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {timeAgo(d.lastSeen)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(d); }}
                            aria-label={`Chỉnh sửa ${d.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.name); }}
                            aria-label={`Xoá ${d.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Tổng:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {filtered.length}
          </span>{" "}
          / {stats.total} thiết bị
        </div>
      </SectionCard>

      {/* Device Details Dialog */}
      <Dialog open={!!viewDevice} onOpenChange={(open) => !open && setViewDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thông tin thiết bị</DialogTitle>
          </DialogHeader>
          {viewDevice && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 text-lg font-bold text-primary">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{viewDevice.name}</div>
                  <div className="text-sm font-mono text-muted-foreground">{viewDevice.id}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">Loại thiết bị:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    {(() => {
                      const typeInfo = DEVICE_TYPES[viewDevice.type] || DEVICE_TYPES.camera;
                      const Icon = typeInfo.icon;
                      return (
                        <>
                          <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                          {typeInfo.label}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <div>
                    {viewDevice.status === "online" ? (
                      <StatusBadge color="green">Online</StatusBadge>
                    ) : viewDevice.status === "offline" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-semibold text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        Offline
                      </span>
                    ) : (
                      <StatusBadge color="red">Lỗi</StatusBadge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Địa chỉ IP:</span>
                  <div className="font-mono text-foreground">{viewDevice.ip}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Vị trí:</span>
                  <div className="text-foreground">{viewDevice.location}</div>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-muted-foreground">Cập nhật cuối:</span>
                  <div className="font-medium">{new Date(viewDevice.lastSeen).toLocaleString('vi-VN')} ({timeAgo(viewDevice.lastSeen)})</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDevice ? "Chỉnh sửa thiết bị" : "Thêm thiết bị mới"}</DialogTitle>
            <DialogDescription>
              {editingDevice
                ? "Cập nhật thông tin cho thiết bị ngoại vi hiện có."
                : "Đăng ký thiết bị ngoại vi mới vào hệ thống quản lý."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dev-id">Mã thiết bị</Label>
              <Input id="dev-id" value={formData.id} disabled className="bg-muted/50 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dev-name">Tên thiết bị</Label>
              <Input
                id="dev-name"
                placeholder="VD: Camera góc ngã tư"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-type">Loại thiết bị</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger id="dev-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="camera">Camera AI</SelectItem>
                    <SelectItem value="controller">Tủ điều khiển</SelectItem>
                    <SelectItem value="display">Màn hình VMS</SelectItem>
                    <SelectItem value="sensor">Cảm biến</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-status">Trạng thái</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="dev-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="error">Báo lỗi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dev-ip">Địa chỉ IP / URL</Label>
              <Input
                id="dev-ip"
                placeholder="VD: 192.168.1.101"
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dev-location">Vị trí lắp đặt</Label>
              <Input
                id="dev-location"
                placeholder="VD: Cột đèn ngã tư Hàng Xanh"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleSave}>{editingDevice ? "Lưu thay đổi" : "Thêm thiết bị"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
