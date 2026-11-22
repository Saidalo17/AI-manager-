// Озвучка текста через браузерный Speech Synthesis API (ru-RU). Работает только на клиенте.

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function emit(speaking: boolean) {
  window.dispatchEvent(new CustomEvent("speech-state", { detail: speaking }));
}

export function speak(text: string): void {
  if (!ttsSupported()) return;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  if (!clean) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "ru-RU";
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ru"));
  if (voice) u.voice = voice;
  u.onstart = () => emit(true);
  u.onend = () => emit(false);
  u.onerror = () => emit(false);
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.cancel();
  emit(false);
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
