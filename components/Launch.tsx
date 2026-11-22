"use client";

import Demo from "./Demo";

export default function Launch({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-medium text-neon-pink">AI Task Manager</p>
        <h1 className="grad-text mt-2 text-5xl font-black tracking-tight sm:text-7xl">Taskly</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm text-dim">
          Надиктуй хаос — ИИ разложит его по матрице Эйзенхауэра и разобьёт на шаги.
        </p>

        <Demo />

        <button
          onClick={onStart}
          disabled={disabled}
          className="mt-8 rounded-3xl bg-neon-cyan px-12 py-4 text-base font-black text-white shadow-[0_0_40px_-6px_var(--color-neon-cyan)] hover:bg-neon-violet"
        >
          ▶ Запуск
        </button>
        <p className="mt-4 text-[10px] font-medium text-dim">без регистрации · нажми, чтобы запустить ИИ</p>
      </div>
    </main>
  );
}
