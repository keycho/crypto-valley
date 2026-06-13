"use client";

import { useEffect, useState } from "react";

import { useFarmStore } from "../stores/farm";

/** Transient action feedback (top-center). */
export function Toast() {
  const toast = useFarmStore((s) => s.toast);
  const seq = useFarmStore((s) => s.toastSeq);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (seq === 0 || !toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [seq, toast]);

  if (!shown) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 14px",
        background: "rgba(43, 34, 24, 0.9)",
        border: "1px solid #34d399",
        borderRadius: 999,
        color: "#f2e8d5",
        fontSize: 13,
      }}
    >
      {shown}
    </div>
  );
}
