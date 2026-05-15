"use client";

import { useState, useRef, useEffect } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

interface TimeInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export default function TimeInput({ value, onChange, disabled = false }: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  const hh = value?.split(":")[0] ?? null;
  const mm = value?.split(":")[1] ?? null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Position panel + scroll selected items into view when opening
  useEffect(() => {
    if (!open) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setAbove(window.innerHeight - rect.bottom < 220);

    requestAnimationFrame(() => {
      if (hh) {
        const el = hourColRef.current?.querySelector(`[data-val="${hh}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "center", behavior: "instant" });
      }
      if (mm) {
        const el = minColRef.current?.querySelector(`[data-val="${mm}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    if (disabled) return;
    if (!open && !value) onChange("09:00");
    setOpen((v) => !v);
  }

  function selectHour(h: string) {
    onChange(`${h}:${mm ?? "00"}`);
  }

  function selectMinute(m: string) {
    onChange(`${hh ?? "09"}:${m}`);
  }

  return (
    <>
      <style>{`
        @keyframes time-fade-down {
          from { opacity: 0; transform: translateY(-5px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes time-fade-up {
          from { opacity: 0; transform: translateY(5px)  scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .time-col { scrollbar-width: none; }
        .time-col::-webkit-scrollbar { display: none; }
        .time-item:hover { background: var(--accent-dim) !important; color: var(--accent) !important; }
      `}</style>

      <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0 }}>

        {/* Trigger */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1px",
            padding: "0.35rem 0.5rem",
            background: "var(--bg-input)",
            border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            boxShadow: open ? "0 0 0 3px var(--accent-dim)" : "none",
            color: disabled || !value ? "var(--text-muted)" : "var(--text)",
            fontSize: "0.875rem",
            fontFamily: "'DM Mono', ui-monospace, 'Fira Code', monospace",
            letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.28 : 1,
            transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {value ? (
            <>
              <span style={{ color: "var(--text)" }}>{hh}</span>
              <span style={{ color: "var(--accent)", opacity: 0.55, margin: "0 1px", fontWeight: 700 }}>:</span>
              <span style={{ color: "var(--text)" }}>{mm}</span>
            </>
          ) : (
            <span style={{ letterSpacing: "0.12em", opacity: 0.4 }}>--:--</span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            style={{
              position: "absolute",
              ...(above ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              background: "var(--bg-card)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--radius)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(55,219,222,0.08)",
              display: "flex",
              overflow: "hidden",
              width: "132px",
              animation: `${above ? "time-fade-up" : "time-fade-down"} 0.13s cubic-bezier(0.16,1,0.3,1) both`,
              transformOrigin: above ? "bottom center" : "top center",
            }}
          >
            {/* Hours column */}
            <div
              ref={hourColRef}
              className="time-col"
              style={{
                flex: 1,
                height: "196px",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {HOURS.map((h) => {
                const sel = h === hh;
                return (
                  <div
                    key={h}
                    data-val={h}
                    className="time-item"
                    onMouseDown={(e) => { e.preventDefault(); selectHour(h); }}
                    style={{
                      padding: "0.42rem 0",
                      textAlign: "center",
                      fontSize: "0.875rem",
                      fontFamily: "'DM Mono', ui-monospace, 'Fira Code', monospace",
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      userSelect: "none",
                      color: sel ? "var(--accent)" : "var(--text)",
                      background: sel ? "var(--accent-dim)" : "transparent",
                      fontWeight: sel ? 600 : 400,
                      transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div
              style={{
                width: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
                fontSize: "0.9rem",
                fontWeight: 700,
                opacity: 0.45,
                flexShrink: 0,
                borderLeft: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
                background: "rgba(55,219,222,0.03)",
                userSelect: "none",
              }}
            >
              :
            </div>

            {/* Minutes column */}
            <div
              ref={minColRef}
              className="time-col"
              style={{
                flex: 1,
                height: "196px",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {MINUTES.map((m) => {
                const sel = m === mm;
                return (
                  <div
                    key={m}
                    data-val={m}
                    className="time-item"
                    onMouseDown={(e) => { e.preventDefault(); selectMinute(m); }}
                    style={{
                      padding: "0.42rem 0",
                      textAlign: "center",
                      fontSize: "0.875rem",
                      fontFamily: "'DM Mono', ui-monospace, 'Fira Code', monospace",
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      userSelect: "none",
                      color: sel ? "var(--accent)" : "var(--text)",
                      background: sel ? "var(--accent-dim)" : "transparent",
                      fontWeight: sel ? 600 : 400,
                      transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {m}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
