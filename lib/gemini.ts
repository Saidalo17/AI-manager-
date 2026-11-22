import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { NewTask } from "./db";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

let ai: GoogleGenAI | null = null;
function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Не задан GEMINI_API_KEY (см. .env.example)");
  return (ai ??= new GoogleGenAI({ apiKey }));
}

export type ImageInput = { mimeType: string; data: string };

async function askJson<T>(prompt: string, schema: object, validator: z.ZodType<T>, image?: ImageInput): Promise<T> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: image
      ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }]
      : prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.3,
    },
  });
  const raw = res.text;
  if (!raw) throw new Error("ИИ вернул пустой ответ");
  try {
    return validator.parse(JSON.parse(raw));
  } catch (err) {
    console.error("[gemini] raw:", raw.slice(0, 800), err);
    throw new Error("ИИ вернул некорректный JSON, попробуйте ещё раз");
  }
}

// ---------- Разбор текста на задачи ----------

const parsedSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        deadline: z.string().nullable(),
        category: z.string(),
        quadrant: z.enum(["q1", "q2", "q3", "q4"]),
        reason: z.string(),
      }),
    )
    .min(1),
});

const parseResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Короткое название задачи, императив" },
          deadline: { type: Type.STRING, nullable: true, description: "Дата YYYY-MM-DD или null" },
          category: { type: Type.STRING, description: "Одно слово: работа, учёба, дом, здоровье, финансы, личное…" },
          quadrant: {
            type: Type.STRING,
            enum: ["q1", "q2", "q3", "q4"],
            description: "q1 срочно и важно; q2 важно не срочно; q3 срочно не важно; q4 не срочно и не важно",
          },
          reason: { type: Type.STRING, description: "Причина приоритета, максимум 7 слов" },
        },
        required: ["title", "deadline", "category", "quadrant", "reason"],
        propertyOrdering: ["title", "deadline", "category", "quadrant", "reason"],
      },
    },
  },
  required: ["tasks"],
};

const cutWords = (s: string, n: number) => s.trim().split(/\s+/).slice(0, n).join(" ");

export async function parseTasks(text: string, image?: ImageInput): Promise<NewTask[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("ru-RU", { weekday: "long" });

  const prompt = `Ты — помощник по планированию. Из сырого текста пользователя (на русском, возможно надиктованного голосом)${image ? " и/или приложенной фотографии (список дел, заметки, доска, скриншот — прочитай текст на фото)" : ""} выдели отдельные задачи.
Сегодня ${today} (${weekday}). Относительные даты («завтра», «в пятницу») переведи в YYYY-MM-DD. Если срока нет — deadline = null.
Для каждой задачи определи квадрант матрицы Эйзенхауэра (q1/q2/q3/q4), категорию одним словом и причину приоритета — не более 7 слов.
Не придумывай задач, которых нет в тексте. Не склеивай разные задачи и не дроби одну.

Текст:
"""
${text || "(текста нет, используй только фото)"}
"""`;

  const out = await askJson(prompt, parseResponseSchema, parsedSchema, image);
  return out.tasks.map((t) => ({
    title: t.title.trim().slice(0, 200),
    quadrant: t.quadrant,
    category: t.category.trim().toLowerCase().slice(0, 30),
    reason: cutWords(t.reason, 7),
    deadline: t.deadline && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline) ? t.deadline : null,
  }));
}

// ---------- Декомпозиция задачи ----------

const stepsSchema = z.object({
  steps: z
    .array(z.object({ title: z.string().min(1), minutes: z.number().int().min(1).max(480) }))
    .min(3)
    .max(5),
});

const stepsResponseSchema = {
  type: Type.OBJECT,
  properties: {
    steps: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Конкретное действие, начинается с глагола" },
          minutes: { type: Type.INTEGER, description: "Оценка времени в минутах" },
        },
        required: ["title", "minutes"],
        propertyOrdering: ["title", "minutes"],
      },
    },
  },
  required: ["steps"],
};

export async function decomposeTask(title: string, category: string): Promise<{ title: string; minutes: number }[]> {
  const prompt = `Разбей задачу на 3–5 конкретных последовательных шагов. Каждый шаг — одно понятное действие (с глагола) и реалистичная оценка времени в минутах. Отвечай на русском.
Задача: «${title}»${category ? `\nКатегория: ${category}` : ""}`;

  const out = await askJson(prompt, stepsResponseSchema, stepsSchema);
  return out.steps.map((s) => ({ title: s.title.trim().slice(0, 200), minutes: s.minutes }));
}

// ---------- Озвучка (нейронный голос) ----------

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Charon"; // спокойный низкий голос

/** Возвращает WAV (PCM 16-bit mono). Прямой REST-вызов: так формат speechConfig точно корректен. */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Не задан GEMINI_API_KEY");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Озвучка недоступна (${res.status})`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error("Модель озвучки не вернула аудио");
  const rate = Number(/rate=(\d+)/.exec(part?.inlineData?.mimeType ?? "")?.[1] ?? 24000);
  return pcmToWav(cleanPcm(Buffer.from(b64, "base64"), rate), rate);
}

/**
 * Gemini TTS иногда добавляет в начало и конец записи короткие громкие плоские всплески шума —
 * это и есть неприятный щелчок в конце реплики. Снимаем такие всплески по одному (с обоих концов),
 * затем делаем плавное нарастание/затухание и добавляем тишину, чтобы плеер не щёлкал.
 * Если после чистки осталось меньше половины записи — возвращаем исходную с одними фейдами.
 */
function cleanPcm(pcm: Buffer, rate: number): Buffer {
  const total = Math.floor(pcm.length / 2);
  const win = Math.round(rate / 100); // окно 10 мс
  const nw = Math.floor(total / win);
  const level: number[] = [];
  for (let w = 0; w < nw; w++) {
    let t = 0;
    for (let i = w * win; i < (w + 1) * win; i++) t += pcm.readInt16LE(i * 2) ** 2;
    level.push(Math.sqrt(t / win));
  }
  const SILENT = 50;
  const MAX_BURST = 20; // ≤ 200 мс

  // всплеск = короткий непрерывный отрезок громкого и почти ровного звука
  const isBurst = (a: number, z: number) => {
    const seg = level.slice(a, z);
    if (seg.length === 0 || seg.length > MAX_BURST) return false;
    const mean = seg.reduce((x, y) => x + y, 0) / seg.length;
    if (mean < 14000) return false;
    if (seg.length < 5) return true;
    const sd = Math.sqrt(seg.reduce((x, y) => x + (y - mean) ** 2, 0) / seg.length);
    return sd / mean < 0.2;
  };

  let lo = 0;
  let hi = nw;
  // хвост
  for (;;) {
    let e = hi;
    while (e > lo && level[e - 1] < SILENT) e--;
    let s0 = e;
    while (s0 > lo && level[s0 - 1] >= SILENT) s0--;
    if (e > lo && isBurst(s0, e)) hi = s0;
    else break;
  }
  // начало
  for (;;) {
    let s0 = lo;
    while (s0 < hi && level[s0] < SILENT) s0++;
    let e = s0;
    while (e < hi && level[e] >= SILENT) e++;
    if (s0 < hi && isBurst(s0, e)) lo = e;
    else break;
  }

  let out = Buffer.from(pcm.subarray(lo * win * 2, hi * win * 2));
  if (out.length < pcm.length * 0.5) out = Buffer.from(pcm); // подстраховка: не режем речь

  const n = out.length / 2;
  const fade = Math.min(Math.round(rate * 0.02), Math.floor(n / 2)); // 20 мс
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out.writeInt16LE(Math.round(out.readInt16LE(i * 2) * g), i * 2);
    const j = n - 1 - i;
    out.writeInt16LE(Math.round(out.readInt16LE(j * 2) * g), j * 2);
  }
  return Buffer.concat([out, Buffer.alloc(Math.round(rate * 0.12) * 2)]); // +120 мс тишины
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
