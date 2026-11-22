// Озвучка: нейронный голос Gemini TTS через /api/tts, запасной вариант — голос браузера (ru-RU).
// Работает только на клиенте.

const listeners = { current: 0 }; // токен текущей озвучки: новый вызов отменяет предыдущий
let audio: HTMLAudioElement | null = null;
let abort: AbortController | null = null;
const cache = new Map<string, Promise<Blob>>();

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

function emit(speaking: boolean) {
  window.dispatchEvent(new CustomEvent("speech-state", { detail: speaking }));
}

/** Режем длинный текст на куски ≤ 350 символов по предложениям */
function chunk(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > 350 && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
    while (cur.length > 350) {
      out.push(cur.slice(0, 350));
      cur = cur.slice(350);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.slice(0, 8);
}

function fetchClip(text: string, signal: AbortSignal): Promise<Blob> {
  let p = cache.get(text);
  if (!p) {
    p = fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    }).then(async (r) => {
      if (!r.ok) throw new Error("tts " + r.status);
      return r.blob();
    });
    p.catch(() => cache.delete(text));
    cache.set(text, p);
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

function playBlob(blob: Blob, token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token !== listeners.current) return resolve();
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    audio = a;
    const done = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    a.onended = done;
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio"));
    };
    a.play().catch((e) => {
      URL.revokeObjectURL(url);
      reject(e);
    });
  });
}

// ---------- запасной голос браузера ----------

function browserSpeak(text: string, token: number): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    const ru = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ru"));
    const voice = ru.find((v) => /pavel|dmitri|yuri|male|павел|дмитр|юрий|google/i.test(v.name)) ?? ru[0];
    if (voice) u.voice = voice;
    u.pitch = 0.9;
    u.rate = 1.03;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    if (token !== listeners.current) return resolve();
    synth.speak(u);
  });
}

export function speak(text: string): void {
  if (!ttsSupported()) return;
  const parts = chunk(text);
  if (parts.length === 0) return;

  stopSpeaking(false);
  const token = ++listeners.current;
  abort = new AbortController();
  const signal = abort.signal;
  emit(true);

  (async () => {
    // предзагружаем все куски сразу, играем по очереди
    const clips = parts.map((p) => fetchClip(p, signal));
    clips.forEach((c) => c.catch(() => {}));
    for (let i = 0; i < parts.length; i++) {
      if (token !== listeners.current) return;
      try {
        await playBlob(await clips[i], token);
      } catch {
        if (token !== listeners.current) return;
        await browserSpeak(parts.slice(i).join(" "), token); // нейроголос недоступен
        break;
      }
    }
  })().finally(() => {
    if (token === listeners.current) emit(false);
  });
}

export function stopSpeaking(notify = true): void {
  listeners.current++;
  abort?.abort();
  abort = null;
  if (audio) {
    // плавно гасим громкость, чтобы остановка не щёлкала
    const a = audio;
    audio = null;
    a.onended = null;
    let v = a.volume;
    const t = setInterval(() => {
      v = Math.max(0, v - 0.25);
      a.volume = v;
      if (v <= 0) {
        clearInterval(t);
        a.pause();
      }
    }, 15);
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (notify && typeof window !== "undefined") emit(false);
}

const KEY = "assistant";

export function assistantOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAssistantOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  window.dispatchEvent(new CustomEvent("assistant-change", { detail: on }));
}

/** Говорит только если ассистент включён */
export function announce(text: string): void {
  if (assistantOn()) speak(text);
}
