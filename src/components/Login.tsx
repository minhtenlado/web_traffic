"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrafficCone, User, Lock, Loader2, Eye, EyeOff, ShieldCheck, Activity, Radar } from "lucide-react";
import { useTrafficStore } from "@/lib/store";

export function Login() {
  const login = useTrafficStore((s) => s.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-gradient absolute -left-1/4 top-0 h-[120%] w-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="animate-gradient absolute -right-1/4 bottom-0 h-[120%] w-1/2 rounded-full bg-chart-2/20 blur-[120px]" style={{ animationDelay: "2s" }} />
        <div
          className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-5/10 blur-[100px]"
        />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-2 shadow-xl shadow-primary/30"
          >
            <TrafficCone className="h-8 w-8 text-primary-foreground" strokeWidth={2.2} />
            <div className="absolute inset-0 animate-gradient rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Giao Thông AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hệ thống Giám sát Giao thông Thông minh
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-primary" />
            Ngã tư Hàng Xanh · TP.HCM
          </div>
        </div>

        {/* Login card */}
        <div className="glass-card overflow-hidden rounded-2xl border border-border shadow-2xl">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Đăng nhập hệ thống</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sử dụng tài khoản được cấp để truy cập
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tài khoản</label>
              <div className="group relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                  className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Nhập tài khoản"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mật khẩu</label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="border-t border-border bg-muted/30 px-6 py-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tài khoản demo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("admin");
                }}
                className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Radar className="h-4 w-4 text-primary" />
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-foreground">Admin</span>
                  <span className="text-[10px] text-muted-foreground">admin / admin</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("staff");
                  setPassword("staff");
                }}
                className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Activity className="h-4 w-4 text-chart-2" />
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-foreground">Vận hành</span>
                  <span className="text-[10px] text-muted-foreground">staff / staff</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2025 Giao Thông AI · Phiên bản 2.3.1
        </p>
      </motion.div>
    </div>
  );
}
