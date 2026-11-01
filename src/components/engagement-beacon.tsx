"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { advanceVisibleClock, type VisibleClock } from "@/domain/engaged-time";

function publicPage(path: string): boolean {
  return path !== "/admin" && !path.startsWith("/admin/");
}

export function EngagementBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!publicPage(pathname)) return;
    let clock: VisibleClock = {
      visibleSinceMs: document.visibilityState === "visible" ? Date.now() : null,
      carryMs: 0,
    };
    const flush = (visible: boolean) => {
      const next = advanceVisibleClock(clock, Date.now(), visible);
      clock = next.clock;
      if (next.seconds < 1) return;
      void fetch("/temps-engage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seconds: next.seconds }),
        credentials: "same-origin",
        keepalive: true,
      });
    };
    const onVisibility = () => flush(document.visibilityState === "visible");
    const onHide = () => flush(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") flush(true);
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      flush(false);
    };
  }, [pathname]);
  return null;
}
