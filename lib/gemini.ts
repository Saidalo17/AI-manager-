import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { NewTask } from "./db";
import { cleanPcm } from "./audio";
import type { Task } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

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

// ---------- Ежедневный анализ нагрузки ----------

export const DAY_CAPACITY_MIN = 360; // 6 часов полезной работы в день
const DEFAULT_TASK_MIN = 30;

const estimate = (t: Task) => {
  const left = t.subtasks.filter((s) => !s.done).reduce((a, s) => a + s.minutes, 0);
  return left > 0 ? left : DEFAULT_TASK_MIN;
};

export interface DayAnalysis {
  verdict: "overloaded" | "balanced" | "light";
  headline: string;
  advice: string;
  load: { minutes: number; capacity: number; count: number };
  move: { id: string; title: string; reason: string }[];
}

export async function analyzeDay(tasks: Task[], today: string): Promise<DayAnalysis> {
  // «на сегодня» = открытые задачи с дедлайном сегодня или раньше
  const todays = tasks.filter((t) => !t.done && t.deadline && t.deadline <= today);
  const minutes = todays.reduce((a, t) => a + estimate(t), 0);
  const verdict: DayAnalysis["verdict"] =
    minutes > DAY_CAPACITY_MIN ? "overloaded" : minutes < DAY_CAPACITY_MIN * 0.4 ? "light" : "balanced";
  const load = { minutes, capacity: DAY_CAPACITY_MIN, count: todays.length };

  const schema = z.object({
    headline: z.string().min(1),
    advice: z.string().min(1),
    move: z.array(z.object({ id: z.string(), reason: z.string() })),
  });
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Короткий вывод о дне, до 10 слов" },
      advice: { type: Type.STRING, description: "Один живой совет, до 25 слов" },
      move: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            reason: { type: Type.STRING, description: "Почему можно перенести, до 8 слов" },
          },
          required: ["id", "reason"],
        },
      },
    },
    required: ["headline", "advice", "move"],
  };

  const list = todays
    .map((t) => `- id=${t.id} | ${t.title} | квадрант ${t.quadrant} | ~${estimate(t)} мин | срок ${t.deadline}`)
    .join("\n");

  const prompt = `Ты — тёплый, лаконичный помощник по планированию дня. Сегодня ${today}.
Ёмкость дня: ${DAY_CAPACITY_MIN} минут. Задачи на сегодня и просроченные: ${todays.length}, суммарно ~${minutes} минут. Вердикт: ${verdict}.
${list || "(задач на сегодня нет)"}

Напиши headline и advice на русском, по-человечески, без канцелярита, с обращением на «ты».
${
  verdict === "overloaded"
    ? `День перегружен. В move выбери задачи для переноса на завтра так, чтобы остаток влез в ${DAY_CAPACITY_MIN} минут. Переноси сначала q4, потом q3, потом q2; q1 не трогай, пока есть другие. Максимум 5 задач. Используй только id из списка.`
    : "День не перегружен: move должен быть пустым массивом."
}`;

  const out = await askJson(prompt, responseSchema, schema);
  const byId = new Map(todays.map((t) => [t.id, t]));
  const move =
    verdict === "overloaded"
      ? out.move
          .filter((m) => byId.has(m.id))
          .slice(0, 5)
          .map((m) => ({ id: m.id, title: byId.get(m.id)!.title, reason: m.reason.trim().split(/\s+/).slice(0, 8).join(" ") }))
      : [];
  return { verdict, headline: out.headline.trim(), advice: out.advice.trim(), load, move };
}
