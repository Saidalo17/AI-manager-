"use client";

import { useEffect, useRef, useState } from "react";
import Magnetic from "./Magnetic";

// Минимальные типы Web Speech API
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export type Photo = { mimeType: string; data: string; preview: string };

// Уменьшаем фото до 1600px и сжимаем в JPEG, чтобы запрос был лёгким
async function readPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Не удалось прочитать фото"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { mimeType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SmartInput({
  onSubmit,
  busy,
  autoFocus,
}: {
  onSubmit: (text: string, image?: { mimeType: string; data: string }) => Promise<void>;
  busy: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText((baseRef.current + " " + t).trim());
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Нет доступа к микрофону" : `Микрофон: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => rec.stop();
  }, []);

  function toggleMic() {
    const rec = recRef.current;
    if (!rec) return;
    setError(null);
    if (listening) {
      rec.stop();
    } else {
      baseRef.current = text;
      rec.start();
      setListening(true);
    }
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setPhoto(await readPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    }
  }

  async function submit() {
    if ((!text.trim() && !photo) || busy) return;
    recRef.current?.stop();
    try {
      await onSubmit(text.trim(), photo ? { mimeType: photo.mimeType, data: photo.data } : undefined);
      setText("");
      setPhoto(null);
    } catch {
      // ошибка показывается над матрицей, ввод сохраняем
    }
  }

  const iconBtn =
    "grid h-12 w-12 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11 border transition disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="rounded-3xl border border-neon-cyan/40 bg-panel/80 p-4 shadow-[0_10px_40px_-18px_rgb(91_91_240/.35)] backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-neon-cyan">
        <span className="inline-block h-2 w-2 rounded-full bg-neon-cyan" /> Что у тебя в голове?
      </div>

      {/* Поле ввода — сверху */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          autoFocus={autoFocus}
          rows={3}
          placeholder="Например: завтра сдать отчёт, позвонить маме, купить кофе…"
          className="scroll-thin w-full resize-none rounded-[28px] border border-line bg-void/70 px-5 py-4 text-base text-ink sm:text-sm outline-none transition placeholder:text-dim focus:border-neon-cyan"
        />
        {listening && <span className="absolute right-5 top-3 text-[10px] font-medium text-neon-pink">● запись</span>}
      </div>

      {photo && (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="Прикреплённое фото" className="h-14 w-14 rounded-lg border border-line object-cover" />
          <span className="text-xs text-dim">Фото прикреплено — ИИ прочитает задачи с него</span>
          <button
            type="button"
            onClick={() => setPhoto(null)}
            aria-label="Убрать фото"
            className="ml-auto px-2 text-dim hover:text-neon-pink"
          >
            ✕
          </button>
        </div>
      )}

      {/* Кнопки — снизу */}
      <div className="mt-3 flex items-center gap-2">
        <Magnetic>
        <button
          type="button"
          onClick={toggleMic}
          disabled={!supported}
          aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
          title={supported ? "Голосовой ввод (ru-RU)" : "Браузер не поддерживает Web Speech API"}
          className={`${iconBtn} ${
            listening
              ? "rec border-neon-pink bg-neon-pink/20 text-neon-pink"
              : "border-line bg-panel-2 text-neon-cyan hover:border-neon-cyan"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        </Magnetic>

        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
        <Magnetic>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Прикрепить фото"
          title="Отправить фото со списком дел"
          className={`${iconBtn} ${
            photo ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-line bg-panel-2 text-neon-cyan hover:border-neon-cyan"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <circle cx="9" cy="11" r="2" />
            <path d="m21 16-5-5-8 8" />
          </svg>
        </button>
        </Magnetic>

        <Magnetic className="ml-auto">
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!text.trim() && !photo)}
          className="h-12 whitespace-nowrap rounded-full sm:h-11 bg-neon-cyan px-5 sm:px-6 text-sm font-bold text-white transition hover:bg-neon-violet disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Разбираю…" : <>✦ Разобрать<span className="hidden min-[360px]:inline"> с ИИ</span></>}
        </button>
        </Magnetic>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-neon-pink">{error}</p>}
      {!supported && (
        <p className="mt-2 text-xs text-dim">Голосовой ввод недоступен в этом браузере — используйте Chrome или Edge.</p>
      )}
    </div>
  );
}
