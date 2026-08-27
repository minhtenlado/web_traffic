"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import the real Leaflet map component with SSR disabled
const LeafletMap = dynamic(
  () => import("./LeafletIntersectionMap").then((mod) => mod.LeafletIntersectionMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export function IntersectionMap() {
  return (
    <div className="relative w-full h-[350px] lg:h-[600px] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 to-background shadow-md shrink-0">
      <LeafletMap />
    </div>
  );
}
