import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/gemini";
import { handle } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Нет текста" }, { status: 400 });
    }
    if (text.length > 600) {
      return NextResponse.json({ error: "Слишком длинный фрагмент" }, { status: 400 });
    }
    const wav = await synthesizeSpeech(text.trim());
    return new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return handle(e);
  }
}
