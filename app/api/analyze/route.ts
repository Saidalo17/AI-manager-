import { NextResponse } from "next/server";
import { listTasks } from "@/lib/db";
import { analyzeDay } from "@/lib/gemini";
import { handle } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { today } = (await req.json()) as { today?: unknown };
    if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return NextResponse.json({ error: "Нужна дата today (YYYY-MM-DD)" }, { status: 400 });
    }
    const result = await analyzeDay(await listTasks(), today);
    return NextResponse.json(result);
  } catch (e) {
    return handle(e);
  }
}
