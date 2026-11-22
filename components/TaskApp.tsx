"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Quadrant, Task } from "@/lib/types";
import Matrix from "./Matrix";
import SmartInput from "./SmartInput";
import Launch from "./Launch";
import Assistant from "./Assistant";
import { announce } from "@/lib/speech";
import { decomposedPhrase, parsedPhrase } from "@/lib/phrases";

export default function TaskApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [swiping, setSwiping] = useState(false);

  // Шторка полностью закрывает экран на середине анимации (600мс) — тогда подменяем экран.
  function launch() {
    setSwiping(true);
    setTimeout(() => setLaunched(true), 600);
    setTimeout(() => setSwiping(false), 1250);
  }
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : "Что-то пошло не так"), []);

  useEffect(() => {
    api
      .list()
      .then(setTasks)
      .catch(fail)
      .finally(() => setLoading(false));
  }, [fail]);

  const patch = (id: string, fn: (t: Task) => Task) => setTasks((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  async function parse(text: string, image?: { mimeType: string; data: string }) {
    setParsing(true);
    setError(null);
    try {
      const created = await api.parse(text, image);
      setTasks((ts) => [...created, ...ts]);
      const urgent = created.filter((t) => t.quadrant === "q1").length;
      announce(parsedPhrase(created.length, urgent));
    } catch (e) {
      fail(e);
      throw e;
    } finally {
      setParsing(false);
    }
  }

  function toggle(t: Task) {
    patch(t.id, (x) => ({ ...x, done: !x.done }));
    api.update(t.id, { done: !t.done }).catch((e) => {
      patch(t.id, (x) => ({ ...x, done: t.done }));
      fail(e);
    });
  }

  function move(t: Task, q: Quadrant) {
    patch(t.id, (x) => ({ ...x, quadrant: q }));
    api.update(t.id, { quadrant: q }).catch((e) => {
      patch(t.id, (x) => ({ ...x, quadrant: t.quadrant }));
      fail(e);
    });
  }

  function remove(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    api.remove(t.id).catch((e) => {
      setTasks((ts) => [t, ...ts]);
      fail(e);
    });
  }

  async function decompose(t: Task) {
    try {
      const subtasks = await api.decompose(t.id);
      patch(t.id, (x) => ({ ...x, subtasks }));
      announce(decomposedPhrase(subtasks.length, subtasks[0]?.title ?? ""));
    } catch (e) {
      fail(e);
    }
  }

  function toggleSub(t: Task, subId: string, done: boolean) {
    const upd = (d: boolean) =>
      patch(t.id, (x) => ({ ...x, subtasks: x.subtasks.map((s) => (s.id === subId ? { ...s, done: d } : s)) }));
    upd(done);
    api.toggleSubtask(subId, done).catch((e) => {
      upd(!done);
      fail(e);
    });
  }

  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const swipe = swiping ? <div className="curve-swipe" aria-hidden /> : null;

  if (!launched)
    return (
      <>
        <Launch onStart={launch} disabled={swiping} />
        {swipe}
      </>
    );

  return (
    <>
    {swipe}
    <Assistant tasks={tasks} />
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-[11px] text-neon-pink">AI Task Manager · <span className="text-neon-green">● ИИ онлайн</span></p>
          <h1 className="grad-text text-4xl font-black tracking-tight sm:text-5xl">
            Taskly
          </h1>
        </div>
        <div className="w-full sm:w-72" aria-label="Прогресс">
          <div className="mb-1 flex justify-between font-medium text-xs">
            <span className="text-dim">
              выполнено {done}/{tasks.length}
            </span>
            <span className="text-neon-green">{pct}%</span>
          </div>
          <div className="h-2 border border-line bg-void">
            <div
              className="h-full bg-gradient-to-r from-neon-pink via-neon-violet to-neon-cyan shadow-[0_0_12px_var(--color-neon-cyan)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <SmartInput onSubmit={parse} busy={parsing} autoFocus />

      {error && (
        <div
          role="alert"
          className="rounded-xl mt-4 flex items-start justify-between gap-3 border border-neon-pink bg-neon-pink/10 px-3 py-2 font-medium text-xs text-neon-pink"
        >
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} aria-label="Закрыть">
            ✕
          </button>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] h-56 animate-pulse border border-line bg-panel/60" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-3xl shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] border border-dashed border-line bg-panel/50 px-6 py-14 text-center">
            <div className="mb-3 text-4xl">✨</div>
            <h2 className="text-lg font-bold text-neon-cyan">Матрица пуста</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-dim">
              Напиши или надиктуй всё, что нужно сделать — ИИ сам разложит задачи по квадрантам, поставит дедлайны и объяснит приоритет.
            </p>
          </div>
        ) : (
          <Matrix
            tasks={tasks}
            onToggle={toggle}
            onMove={move}
            onDelete={remove}
            onDecompose={decompose}
            onToggleSubtask={toggleSub}
          />
        )}
      </div>
    </main>
    </>
  );
}
