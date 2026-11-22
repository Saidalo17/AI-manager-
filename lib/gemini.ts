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
