"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrafficCone, User, Lock, Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert, LockKeyhole } from "lucide-react";
import { useTrafficStore } from "@/lib/store";

export function Login() {
  const login = useTrafficStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Rate limiting / brute-force lockout states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setLoading(true);
    setError("");

    try {
      await login(username.trim(), password);
      setFailedAttempts(0);
    } catch (err: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      
      if (attempts >= 5) {
        setLockoutSeconds(30);
        setError("Bạn đã nhập sai quá 5 lần. Tạm khóa đăng nhập 30 giây để bảo mật.");
      } else {
        setError(err.message || "Tài khoản hoặc mật khẩu không chính xác");
      }
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
            Hệ thống Giám sát & Điều khiển Giao thông Thông minh
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-primary" />
            Ngã tư Hàng Xanh · TP.HCM
          </div>
        </div>

        {/* Login card */}
        <div className="glass-card overflow-hidden rounded-2xl border border-border shadow-2xl">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Đăng nhập hệ thống</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Yêu cầu xác thực tài khoản được cấp quyền
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LockKeyhole className="h-4 w-4" />
              </div>
            </div>
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
                  disabled={lockoutSeconds > 0 || loading}
                  autoFocus
                  required
                  className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  placeholder="Nhập tên tài khoản"
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
                  disabled={lockoutSeconds > 0 || loading}
                  required
                  className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  disabled={lockoutSeconds > 0}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xác thực...
                </>
              ) : lockoutSeconds > 0 ? (
                `Vui lòng chờ (${lockoutSeconds}s)`
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Security Badge Footer */}
          <div className="border-t border-border bg-muted/20 px-6 py-3">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Bảo mật kết nối SSL/TLS 256-bit</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Giao Thông AI · Trung tâm Giám sát Điều hành Giao thông
        </p>
      </motion.div>
    </div>
  );
}
