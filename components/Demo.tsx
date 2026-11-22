"use client";

import { useEffect, useState } from "react";
import { QUADRANTS } from "@/lib/types";

// Демо без запросов к ИИ: голосовой «хаос» → готовый план. Крутится по кругу.
const SPEECH = "так… завтра сдать отчёт, молоко купить, к врачу записаться, ещё сериал вечером";

const ITEMS = [
  { title: "Сдать отчёт", reason: "дедлайн завтра", q: 0, chaos: { x: 6, y: 24, r: -9 }, tag: "работа" },
  { title: "Записаться к врачу", reason: "здоровье важно", q: 1, chaos: { x: 52, y: 40, r: 7 }, tag: "здоровье" },
  { title: "Купить молоко", reason: "бытовое, не горит", q: 2, chaos: { x: 14, y: 62, r: 5 }, tag: "дом" },
  { title: "Сериал вечером", reason: "отдых, не срочно", q: 3, chaos: { x: 50, y: 74, r: -6 }, tag: "личное" },
];

// ячейки 2×2 в проценте от контейнера
const CELL = [
  { x: 2, y: 20 },
  { x: 51, y: 20 },
  { x: 2, y: 60 },
  { x: 51, y: 60 },
];

type Phase = "chaos" | "sort" | "plan";

export default function Demo() {
  const [phase, setPhase] = useState<Phase>("chaos");
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("plan");
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const typer: { id?: ReturnType<typeof setInterval> } = {};
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));

    const cycle = () => {
      setPhase("chaos");
      setTyped(0);
      typer.id = setInterval(() => setTyped((t) => Math.min(SPEECH.length, t + 2)), 45);
      later(() => clearInterval(typer.id), 45 * (SPEECH.length / 2) + 50);
      later(() => setPhase("sort"), 3300);
      later(() => setPhase("plan"), 4300);
      later(cycle, 10000);
    };
    cycle();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      clearInterval(typer.id);
    };
  }, []);

  const plan = phase !== "chaos";

  return (
    <div
      className="relative mx-auto mt-8 h-[19rem] w-full max-w-md overflow-hidden rounded-3xl border border-line bg-panel/70 shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] backdrop-blur"
      aria-label="Демонстрация: голосовой хаос превращается в план"
      role="img"
    >
      {/* строка «голоса» */}
      <div className="absolute inset-x-3 top-3 flex h-10 items-center gap-2 text-left">
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm transition-colors duration-500 ${
            plan ? "bg-neon-green/20 text-neon-green" : "rec bg-neon-pink/20 text-neon-pink"
          }`}
        >
          {plan ? "✓" : "🎙"}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-dim">
          {plan ? (
            <span className="font-medium text-ink">ИИ разложил 4 задачи за секунду</span>
          ) : (
            <>
              {SPEECH.slice(0, typed)}
              <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-neon-pink align-middle" />
            </>
          )}
        </p>
      </div>

      {/* рамки квадрантов появляются, когда план готов */}
      {CELL.map((c, i) => (
        <div
          key={i}
          className="absolute h-[34%] w-[47%] rounded-2xl border border-dashed transition-all duration-700"
          style={{
            left: `${c.x}%`,
            top: `${c.y - 1}%`,
            borderColor: plan ? QUADRANTS[i].color : "transparent",
            opacity: plan ? 0.55 : 0,
            transform: plan ? "scale(1)" : "scale(.92)",
          }}
        />
      ))}

      {/* карточки: хаос → ячейки */}
      {ITEMS.map((it, i) => {
        const to = CELL[it.q];
        const x = plan ? to.x : it.chaos.x;
        const y = plan ? to.y : it.chaos.y;
        const color = QUADRANTS[it.q].color;
        return (
          <div
            key={it.title}
            className="absolute w-[46%] rounded-xl border bg-panel-2 px-2.5 py-2 text-left shadow-md will-change-transform"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `rotate(${plan ? 0 : it.chaos.r}deg) scale(${phase === "sort" ? 1.06 : 1})`,
              borderColor: plan ? color : "var(--color-line)",
              filter: phase === "chaos" ? "blur(.4px)" : "none",
              transition: `left .9s cubic-bezier(.34,1.3,.64,1) ${i * 70}ms, top .9s cubic-bezier(.34,1.3,.64,1) ${i * 70}ms, transform .9s cubic-bezier(.34,1.3,.64,1) ${i * 70}ms, border-color .6s`,
            }}
          >
            <div className="truncate text-xs font-semibold text-ink">{it.title}</div>
            <div
              className="mt-1 truncate text-[10px] font-medium transition-opacity duration-500"
              style={{ color, opacity: plan ? 1 : 0 }}
            >
              ✦ {it.reason}
            </div>
          </div>
        );
      })}

      {/* подписи квадрантов */}
      {CELL.map((c, i) => (
        <div
          key={i}
          className="pointer-events-none absolute text-[9px] font-bold transition-opacity duration-700"
          style={{ left: `${c.x + 2}%`, top: `${c.y + 29}%`, color: QUADRANTS[i].color, opacity: plan ? 1 : 0 }}
        >
          {QUADRANTS[i].title}
        </div>
      ))}
    </div>
  );
}
