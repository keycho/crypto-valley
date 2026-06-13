"use client";

import { useEffect, useRef, useState } from "react";

import { gameBus } from "../game/bus";
import { useMpStore } from "../stores/mp";

/**
 * Zone chat (bottom-left). Enter focuses the input, Esc blurs it; while focused,
 * `typing` is set so Phaser ignores movement/hotbar keys.
 */
export function Chat() {
  const chat = useMpStore((s) => s.chat);
  const setTyping = useMpStore((s) => s.setTyping);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  // Enter (when not already typing) focuses the chat input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Enter" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const msg = value.trim();
      if (msg) gameBus.emit("chatSend", { msg: msg.slice(0, 200) });
      setValue("");
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 300 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {chat.slice(-7).map((line) => (
          <div
            key={line.id}
            style={{
              alignSelf: "flex-start",
              maxWidth: "100%",
              padding: "2px 8px",
              background: "rgba(15, 17, 23, 0.6)",
              borderRadius: 5,
              fontSize: 12,
              wordBreak: "break-word",
            }}
          >
            <span style={{ color: "#5ee6a8" }}>{line.from}</span>{" "}
            <span style={{ color: "#f2e8d5" }}>{line.msg}</span>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        maxLength={200}
        placeholder="Press Enter to chat…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        style={{
          pointerEvents: "auto",
          padding: "6px 10px",
          background: "rgba(15, 17, 23, 0.8)",
          border: "1px solid #2a2d3a",
          borderRadius: 6,
          color: "#f2e8d5",
          font: "inherit",
          fontSize: 13,
        }}
      />
    </div>
  );
}
