"use client";

import { useEffect, useState } from "react";
import { DND_EVENT } from "@/lib/drag";
import { QUADRANTS, type Quadrant, type Task } from "@/lib/types";
import TaskCard from "./TaskCard";

type Handlers = {
  onToggle: (t: Task) => void;
  onMove: (t: Task, q: Quadrant) => void;
  onDelete: (t: Task) => void;
  onDecompose: (t: Task) => Promise<void>;
  onToggleSubtask: (t: Task, subId: string, done: boolean) => void;
};

export default function Matrix({ tasks, ...h }: { tasks: Task[] } & Handlers) {
  const [over, setOver] = useState<Quadrant | null>(null);

  useEffect(() => {
    const on = (e: Event) => setOver((e as CustomEvent<Quadrant | null>).detail);
    window.addEventListener(DND_EVENT, on);
    return () => window.removeEventListener(DND_EVENT, on);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {QUADRANTS.map((q) => {
        const items = tasks.filter((t) => t.quadrant === q.id);
        return (
          <section
            key={q.id}
            data-quadrant={q.id}
            className="rounded-3xl shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] flex min-h-56 flex-col border bg-panel/70 p-4 backdrop-blur transition"
            style={{
              borderColor: over === q.id ? q.color : "var(--color-line)",
              boxShadow: over === q.id ? `0 0 30px -8px ${q.color}` : undefined,
            }}
          >
            <header className="mb-3 flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold" style={{ color: q.color }}>
                  {q.title}
                </h2>
                <p className="font-medium text-[10px] text-dim">{q.hint}</p>
              </div>
              <span className="font-medium text-xs" style={{ color: q.color }}>
                [{items.length}]
              </span>
            </header>
            <div className="scroll-thin flex flex-1 flex-col gap-2 overflow-y-auto md:max-h-[28rem]">
              {items.length === 0 ? (
                <div className="grid flex-1 place-items-center border border-dashed border-line rounded-2xl p-6 text-center font-medium text-xs text-dim">
                  <span>
                    Пусто
                    <br />
                    потяни сюда задачу за ⠿
                  </span>
                </div>
              ) : (
                items.map((t) => <TaskCard key={t.id} task={t} {...h} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
