"use client";

import { useState } from "react";
import { api, type DayAnalysisResult } from "@/lib/api";
import { announce } from "@/lib/speech";

const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const VERDICT = {
  overloaded: { color: "var(--color-neon-pink)", icon: "🔥", label: "Перегруз" },
  balanced: { color: "var(--color-neon-green)", icon: "✅", label: "Нормальный день" },
  light: { color: "var(--color-neon-cyan)", icon: "🌤", label: "День лёгкий" },
} as const;

export default function DayAnalysis({
  hasTasks,
  onMove,
  onError,
}: {
  hasTasks: boolean;
  onMove: (ids: string[], date: string) => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DayAnalysisResult | null>(null);
  const [applied, setApplied] = useState(false);

  async function run() {
    setBusy(true);
    setApplied(false);
    try {
      const r = await api.analyze(localDate(0));
      setRes(r);
      announce(`${r.headline} ${r.advice}`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!res) return;
    onMove(
      res.move.map((m) => m.id),
      localDate(1),
    );
    setApplied(true);
  }

  const v = res ? VERDICT[res.verdict] : null;
  const pct = res ? Math.min(100, Math.round((res.load.minutes / res.load.capacity) * 100)) : 0;
  const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60 ? `${m % 60} мин` : ""}`.trim() : `${m} мин`);

  return (
    <div className="mt-4">
      <div className="flex justify-end">
        <button
          onClick={run}
          disabled={busy || !hasTasks}
          className="rounded-full border border-neon-violet/60 bg-panel px-5 py-2.5 text-sm font-medium text-neon-violet transition hover:bg-neon-violet hover:text-white disabled:opacity-40"
          title={hasTasks ? "ИИ оценит нагрузку на сегодня" : "Сначала добавь задачи"}
        >
          {busy ? "Считаю нагрузку…" : "🧠 Анализ дня"}
        </button>
      </div>

      {res && v && (
        <section
          className="pop-in mt-3 rounded-3xl border bg-panel/80 p-4 shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] backdrop-blur"
          style={{ borderColor: v.color }}
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold" style={{ color: v.color }}>
                {v.icon} {v.label}
              </p>
              <h3 className="mt-1 text-base font-semibold leading-snug">{res.headline}</h3>
            </div>
            <button onClick={() => setRes(null)} aria-label="Закрыть" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim hover:text-neon-pink">
              ✕
            </button>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] font-medium text-dim">
              <span>
                На сегодня: {res.load.count} задач · {hours(res.load.minutes)}
              </span>
              <span>норма {hours(res.load.capacity)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: v.color }} />
            </div>
          </div>

          <p className="mt-3 text-sm text-dim">{res.advice}</p>

          {res.move.length > 0 && (
            <div className="mt-4 rounded-2xl border border-line bg-panel-2/70 p-3">
              <p className="mb-2 text-xs font-bold">
                {applied ? "Перенесено на завтра:" : `Перенеси ${res.move.length} на завтра:`}
              </p>
              <ul className="space-y-1.5">
                {res.move.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{applied ? "✓ " : "→ "}{m.title}</span>
                    <span className="text-xs text-dim">{m.reason}</span>
                  </li>
                ))}
              </ul>
              {!applied && (
                <button
                  onClick={apply}
                  className="mt-3 w-full rounded-full bg-neon-pink px-5 py-3 text-sm font-bold text-white sm:w-auto"
                >
                  Перенести на завтра
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
