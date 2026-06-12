"use client";

import { useEffect, useState } from "react";

/**
 * Placeholder for the Phaser 3 canvas (arrives next session). Rendering it via
 * next/dynamic({ ssr: false }) keeps all client-only engine code out of SSR.
 */
export default function GameMount() {
  const [mountedAt, setMountedAt] = useState<string | null>(null);

  useEffect(() => {
    // Runs only in the browser — confirms the client-only mount worked.
    setMountedAt(new Date().toISOString());
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "0.75rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 480,
          maxWidth: "90vw",
          aspectRatio: "16 / 9",
          border: "2px dashed #5ee6a8",
          borderRadius: 8,
          imageRendering: "pixelated",
        }}
      >
        <span>🌱 Crypto Valley — client mounted</span>
      </div>
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        Phaser 3 canvas lands next session.
        {mountedAt ? ` Mounted at ${mountedAt}.` : ""}
      </p>
    </main>
  );
}
