"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTrafficStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTrafficStore((s) => s.theme);
  const tick = useTrafficStore((s) => s.tick);
  const activeSection = useTrafficStore((s) => s.activeSection);
  const isMobile = useIsMobile();

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Default sidebar state based on viewport (open on desktop, closed on mobile)
  useEffect(() => {
    const store = useTrafficStore.getState();
    if (isMobile && store.sidebarOpen) {
      store.toggleSidebar();
    } else if (!isMobile && !store.sidebarOpen) {
      store.toggleSidebar();
    }
  }, [isMobile]);

  // Real-time tick (1s)
  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-slow absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-float-slow absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-chart-2/10 blur-3xl" style={{ animationDelay: "3s" }} />
      </div>

      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="relative flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[1600px] p-4 sm:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
