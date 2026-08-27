"use client";

import { useEffect, useState } from "react";
import { useTrafficStore } from "@/lib/store";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/components/Login";
import { Dashboard } from "@/components/sections/Dashboard";
import { Analytics } from "@/components/sections/Analytics";
import { SignalControl } from "@/components/sections/SignalControl";
import { LiveMonitoring } from "@/components/sections/LiveMonitoring";
import { Alerts } from "@/components/sections/Alerts";
import { ModelManagement } from "@/components/sections/ModelManagement";
import { SystemHealth } from "@/components/sections/SystemHealth";
import { AuditLog } from "@/components/sections/AuditLog";
import { Admin } from "@/components/sections/Admin";
import { Profile } from "@/components/sections/Profile";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useTrafficStore((s) => s.isAuthenticated);
  const activeSection = useTrafficStore((s) => s.activeSection);
  const user = useTrafficStore((s) => s.user);

  useEffect(() => {
    // hydrate theme + mark mounted (legitimate client-only init)
    const stored = (localStorage.getItem("theme") as "dark" | "light") || "dark";
    document.documentElement.classList.toggle("dark", stored === "dark");
    // Hydrate auth + realtime data immediately from localStorage / generators
    try {
      const u = localStorage.getItem("auth_user");
      if (u) useTrafficStore.setState({ user: JSON.parse(u), isAuthenticated: true });
    } catch {
      /* ignore */
    }
    useTrafficStore.setState({ theme: stored });
    useTrafficStore.getState().refreshRealtime();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "camera":
        return <LiveMonitoring />;
      case "analytics":
        return <Analytics />;
      case "signal":
        return <SignalControl />;
      case "model":
        return <ModelManagement />;
      case "alerts":
        return <Alerts />;
      case "audit":
        return user?.role === "admin" ? <AuditLog /> : <Dashboard />;
      case "admin":
        return user?.role === "admin" ? <Admin /> : <Dashboard />;
      case "health":
        return user?.role === "admin" ? <SystemHealth /> : <Dashboard />;
      case "profile":
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  return <AppShell>{renderSection()}</AppShell>;
}
