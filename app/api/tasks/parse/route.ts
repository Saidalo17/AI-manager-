import { NextResponse } from "next/server";
import { insertTasks } from "@/lib/db";
import { parseTasks } from "@/lib/gemini";
import { handle } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown; image?: { mimeType?: unknown; data?: unknown } };
    const text = typeof body.text === "string" ? body.text : "";
    let image: { mimeType: string; data: string } | undefined;
    if (body.image) {
      const { mimeType, data } = body.image;
      if (typeof mimeType !== "string" || !/^image\/(jpeg|png|webp)$/.test(mimeType) || typeof data !== "string") {
        return NextResponse.json({ error: "Неподдерживаемое изображение" }, { status: 400 });
      }
      if (data.length > 7_000_000) {
        return NextResponse.json({ error: "Фото слишком большое" }, { status: 400 });
      }
      image = { mimeType, data };
    }
    if (!text.trim() && !image) {
      return NextResponse.json({ error: "Введите текст или добавьте фото" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Слишком длинный текст (макс. 5000 символов)" }, { status: 400 });
    }
    const parsed = await parseTasks(text, image);
    const tasks = await insertTasks(parsed);
    return NextResponse.json({ tasks });
  } catch (e) {
    return handle(e);
  }
}
