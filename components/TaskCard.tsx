"use client";

import { useRef, useState } from "react";
import { startCardDrag } from "@/lib/drag";
import { QUADRANTS, type Quadrant, type Task } from "@/lib/types";

function deadlineInfo(d: string | null): { label: string; cls: string } | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(d + "T00:00:00");
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `просрочено на ${-diff} дн.`, cls: "border-neon-pink text-neon-pink" };
  if (diff === 0) return { label: "сегодня", cls: "border-neon-yellow text-neon-yellow" };
  if (diff === 1) return { label: "завтра", cls: "border-neon-yellow/70 text-neon-yellow" };
  const label = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return { label, cls: "border-line text-dim" };
}

export default function TaskCard({
  task,
  onToggle,
  onMove,
  onDelete,
  onDecompose,
  onToggleSubtask,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onMove: (t: Task, q: Quadrant) => void;
  onDelete: (t: Task) => void;
  onDecompose: (t: Task) => Promise<void>;
  onToggleSubtask: (t: Task, subId: string, done: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const dl = deadlineInfo(task.deadline);
  const totalMin = task.subtasks.reduce((s, x) => s + x.minutes, 0);
  const subDone = task.subtasks.filter((s) => s.done).length;

  async function decompose() {
    setLoading(true);
    try {
      await onDecompose(task);
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      ref={cardRef}
      className={`pop-in group rounded-xl border border-line bg-panel-2/80 p-3 transition hover:border-dim ${task.done ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onPointerDown={(e) => cardRef.current && startCardDrag(e, cardRef.current, (q) => onMove(task, q), task.quadrant)}
          aria-label="Перетащить в другой квадрант"
          title="Потяни, чтобы перенести в другой квадрант"
          className="-ml-1 grid h-10 w-8 shrink-0 sm:h-8 sm:w-6 cursor-grab touch-none select-none place-items-center rounded-md text-lg leading-none text-dim hover:bg-line/60 active:cursor-grabbing"
        >
          ⠿
        </button>
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => onToggle(task)}
          aria-label="Выполнено"
          className="mt-1.5 h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-md border-2 border-dim bg-void checked:border-neon-green checked:bg-neon-green sm:mt-1 sm:h-5 sm:w-5"
        />
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-medium leading-snug ${task.done ? "line-through" : ""}`}>{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5 font-medium text-[10px]">
            {task.reason && (
              <span className="border border-neon-violet/60 bg-neon-violet/10 px-1.5 py-0.5 text-neon-violet">✦ {task.reason}</span>
            )}
            {dl && <span className={`border px-1.5 py-0.5 ${dl.cls}`}>⏱ {dl.label}</span>}
            {task.category && <span className="border border-line px-1.5 py-0.5 text-dim">#{task.category}</span>}
          </div>
        </div>
        <button
          onClick={() => onDelete(task)}
          aria-label="Удалить"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-base text-dim sm:h-8 sm:w-8 opacity-70 transition hover:bg-neon-pink/10 hover:text-neon-pink group-hover:opacity-100"
        >
          ✕
        </button>
      </div>

      {task.subtasks.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1 flex justify-between font-medium text-[10px] text-dim">
            <span>
              шаги {subDone}/{task.subtasks.length}
            </span>
            <span>~{totalMin} мин</span>
          </div>
          <ul className="space-y-1">
            {task.subtasks.map((s) => (
              <li key={s.id} className="flex items-start gap-2.5 py-0.5 text-sm sm:text-xs">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(e) => onToggleSubtask(task, s.id, e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border-2 border-dim bg-void checked:border-neon-cyan checked:bg-neon-cyan sm:h-4 sm:w-4"
                />
                <span className={`flex-1 ${s.done ? "text-dim line-through" : ""}`}>{s.title}</span>
                <span className="font-medium text-[10px] text-dim">{s.minutes}м</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {task.subtasks.length === 0 ? (
          <button
            onClick={decompose}
            disabled={loading || task.done}
            className="rounded-xl border border-neon-cyan/50 px-4 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan hover:text-white disabled:opacity-40"
          >
            {loading ? "думаю…" : "⚡ Разбить на шаги"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2" role="group" aria-label="Переместить в квадрант">
          {QUADRANTS.map((q, i) => {
            const active = q.id === task.quadrant;
            return (
              <button
                key={q.id}
                onClick={() => onMove(task, q.id)}
                disabled={active}
                title={`→ ${q.title}`}
                aria-label={`Переместить: ${q.title}`}
                className="grid h-10 w-10 place-items-center rounded-lg border text-sm font-bold sm:h-8 sm:w-8 leading-none transition enabled:hover:scale-110"
                style={{
                  borderColor: q.color,
                  color: active ? "#fff" : q.color,
                  background: active ? q.color : "transparent",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
