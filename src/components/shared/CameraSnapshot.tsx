"use client";

import { useEffect, useState } from "react";

const SNAPSHOT_REFRESH_MS = 10_000;

function withCacheBust(url: string, stamp: number) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${stamp}`;
}

export function CameraSnapshot({
  src,
  alt,
  className = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [stamp, setStamp] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFailed(false);
      setStamp(Date.now());
    }, SNAPSHOT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 px-4 text-center text-xs text-muted-foreground">
        Không tải được ảnh camera. Đang thử lại…
      </div>
    );
  }

  return (
    <img
      src={withCacheBust(src, stamp)}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
