"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { assistantOn, setAssistantOn, speak, stopSpeaking, ttsSupported } from "@/lib/speech";
import { greetPhrase, summaryPhrase } from "@/lib/phrases";
import Magnetic from "./Magnetic";

function getSelectedText(): string {
  const a = document.activeElement;
  if (a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && a.type === "text")) {
    const s = a.value.slice(a.selectionStart ?? 0, a.selectionEnd ?? 0).trim();
    if (s) return s;
  }
  return window.getSelection()?.toString().trim() ?? "";
}

function summary(tasks: Task[]): string {
  const open = tasks.filter((t) => !t.done);
  const urgent = open.filter((t) => t.quadrant === "q1").map((t) => t.title);
  return summaryPhrase(tasks.length, tasks.length - open.length, urgent, open.length);
}

export default function Assistant({ tasks }: { tasks: Task[] }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sel, setSel] = useState("");

  useEffect(() => {
    setSupported(ttsSupported());
    setOn(assistantOn());
    const onSel = () => setSel(getSelectedText());
    const onSpeech = (e: Event) => setSpeaking((e as CustomEvent<boolean>).detail);
    const onAssistant = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    document.addEventListener("selectionchange", onSel);
    document.addEventListener("keyup", onSel);
    document.addEventListener("mouseup", onSel);
    window.addEventListener("speech-state", onSpeech);
    window.addEventListener("assistant-change", onAssistant);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      document.removeEventListener("keyup", onSel);
      document.removeEventListener("mouseup", onSel);
      window.removeEventListener("speech-state", onSpeech);
      window.removeEventListener("assistant-change", onAssistant);
      stopSpeaking();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const next = !on;
    setAssistantOn(next);
    if (next) speak(greetPhrase());
    else stopSpeaking();
  }

  // mousedown не должен сбрасывать выделение, пока нажимаем кнопки ассистента
  const keepSel = (e: React.MouseEvent) => e.preventDefault();

  const pill =
    "flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium backdrop-blur sm:h-11 sm:px-4 shadow-[0_8px_24px_-10px_rgb(91_91_240/.55)]";

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[60] flex flex-col items-end gap-2" onMouseDown={keepSel}>
      {sel && (
        <Magnetic>
          <button
            onClick={() => speak(sel)}
            className={`${pill} max-w-[80vw] border-neon-cyan bg-neon-cyan text-white`}
            title={sel}
          >
            🔊 Озвучить<span className="hidden sm:inline"> выделенное</span>
          </button>
        </Magnetic>
      )}
      <div className="flex items-center gap-2">
        {speaking && (
          <button onClick={() => stopSpeaking()} className={`${pill} border-neon-pink bg-panel text-neon-pink`} aria-label="Остановить озвучку">
            ⏹<span className="hidden sm:inline"> Стоп</span>
          </button>
        )}
        <Magnetic>
          <button
            onClick={() => speak(summary(tasks))}
            className={`${pill} border-line bg-panel text-ink`}
            title="Голосовая сводка по задачам"
          >
            📋<span className="hidden sm:inline"> Сводка</span>
          </button>
        </Magnetic>
        <Magnetic>
          <button
            onClick={toggle}
            aria-pressed={on}
            className={`${pill} ${on ? "border-neon-green bg-neon-green/15 text-neon-green" : "border-line bg-panel text-ink"}`}
            title="Ассистент озвучивает результаты ИИ"
          >
            🎧<span className="hidden sm:inline"> Ассистент: </span>{on ? "вкл" : "выкл"}
          </button>
        </Magnetic>
      </div>
    </div>
  );
}
