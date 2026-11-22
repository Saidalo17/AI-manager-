"use client";

export default function Launch({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="font-medium text-[11px] text-neon-pink">AI Task Manager</p>
        <h1 className="grad-text mt-2 text-5xl font-black tracking-tight sm:text-7xl">
          Taskly
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm text-dim">
          Надиктуй хаос — ИИ разложит его по матрице Эйзенхауэра и разобьёт на шаги.
        </p>
        <button
          onClick={onStart}
          disabled={disabled}
          className="rounded-3xl shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] mt-10 bg-neon-cyan px-12 py-4 text-base font-black text-white shadow-[0_0_40px_-6px_var(--color-neon-cyan)] hover:bg-neon-violet"
        >
          ▶ Запуск
        </button>
        <p className="mt-4 font-medium text-[10px] text-dim">нажми, чтобы запустить ИИ</p>
      </div>
    </main>
  );
}
