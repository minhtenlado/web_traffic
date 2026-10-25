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
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-background">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="relative flex-1 overflow-y-auto scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
