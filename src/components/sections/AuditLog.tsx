"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  CalendarCheck,
  Search,
  Download,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { formatDateTime } from "@/lib/formatters";
import { StatCard, SectionCard, StatusBadge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | "admin" | "operator" | "auto";
type DateFilter = "all" | "today" | "7d" | "30d";
type SortDir = "desc" | "asc";

function roleToBadge(role: string) {
  if (role === "Admin") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {role}
      </span>
    );
  }
  if (role === "Vận hành viên") {
    return <StatusBadge color="cyan">{role}</StatusBadge>;
  }
  if (role === "Tự động") {
    return <StatusBadge color="purple">{role}</StatusBadge>;
  }
  return <StatusBadge color="green">{role}</StatusBadge>;
}

export function AuditLog() {
  const auditLog = useTrafficStore((s) => s.auditLog);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const stats = useMemo(() => {
    const total = auditLog.length;
    const uniqueUsers = new Set(auditLog.map((l) => l.user)).size;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const actionsToday = auditLog.filter(
      (l) => new Date(l.timestamp).getTime() >= todayStart.getTime(),
    ).length;
    return { total, uniqueUsers, actionsToday };
  }, [auditLog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const dateCutoff =
      dateFilter === "today"
        ? new Date().setHours(0, 0, 0, 0)
        : dateFilter === "7d"
          ? now - 7 * 86400000
          : dateFilter === "30d"
            ? now - 30 * 86400000
            : 0;

    return auditLog
      .filter((l) => {
        if (
          q &&
          !l.user.toLowerCase().includes(q) &&
          !l.action.toLowerCase().includes(q)
        )
          return false;
        if (roleFilter === "admin" && l.role !== "Admin") return false;
        if (roleFilter === "operator" && l.role !== "Vận hành viên") return false;
        if (roleFilter === "auto" && l.role !== "Tự động") return false;
        if (dateFilter !== "all" && new Date(l.timestamp).getTime() < dateCutoff)
          return false;
        return true;
      })
      .sort((a, b) => {
        const diff =
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return sortDir === "desc" ? -diff : diff;
      });
  }, [auditLog, search, roleFilter, dateFilter, sortDir]);

  const toggleSort = () => setSortDir((d) => (d === "desc" ? "asc" : "desc"));

  const handleExport = () => {
    toast({
      title: "Xuất báo cáo nhật ký",
      description: `Đã xuất ${filtered.length} bản ghi ra CSV (mô phỏng).`,
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setDateFilter("all");
  };

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Tổng hành động"
          value={stats.total}
          unit="lượt"
          trend="up"
          trendValue="realtime"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={Users}
          label="Người dùng hoạt động"
          value={stats.uniqueUsers}
          unit="người"
          trend="neutral"
          trendValue="có ghi nhận"
          color="cyan"
          delay={0.05}
        />
        <StatCard
          icon={CalendarCheck}
          label="Hành động hôm nay"
          value={stats.actionsToday}
          unit="lượt"
          trend="up"
          trendValue="trong ngày"
          color="purple"
          delay={0.1}
        />
      </div>

      {/* Audit log table */}
      <SectionCard
        title="Nhật ký hoạt động hệ thống"
        subtitle="Theo dõi thao tác của người dùng và hệ thống AI"
        icon={ShieldCheck}
        action={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Xuất CSV
          </Button>
        }
      >
        {/* Filter bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo người dùng hoặc hành động..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as RoleFilter)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Vai trò" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả vai trò</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operator">Vận hành viên</SelectItem>
              <SelectItem value="auto">Tự động (AI)</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateFilter}
            onValueChange={(v) => setDateFilter(v as DateFilter)}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi thời gian</SelectItem>
              <SelectItem value="today">Hôm nay</SelectItem>
              <SelectItem value="7d">7 ngày qua</SelectItem>
              <SelectItem value="30d">30 ngày qua</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border [&>[data-slot=table-container]]:max-h-[600px] [&>[data-slot=table-container]]:overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[200px]">
                  <button
                    onClick={toggleSort}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Thời gian
                    {sortDir === "desc" ? (
                      <ArrowDown className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowUp className="h-3 w-3 text-primary" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead className="min-w-[280px]">Hành động</TableHead>
                <TableHead className="text-right">Địa chỉ IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <FileText className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Không tìm thấy bản ghi phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-primary/5",
                      "data-[state=selected]:bg-muted",
                    )}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(log.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {log.user}
                    </TableCell>
                    <TableCell>{roleToBadge(log.role)}</TableCell>
                    <TableCell className="text-sm text-foreground">
                      {log.action}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {log.ip}
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer summary */}
        <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>
            Hiển thị{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {filtered.length}
            </span>{" "}
            / {stats.total} bản ghi
          </span>
          <div className="flex items-center gap-3">
            {(search || roleFilter !== "all" || dateFilter !== "all") && (
              <button
                onClick={handleClearFilters}
                className="text-primary transition-colors hover:text-primary/80"
              >
                Xoá bộ lọc
              </button>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-success" />
              Cập nhật theo thời gian thực
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
