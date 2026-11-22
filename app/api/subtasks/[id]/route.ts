import { NextResponse } from "next/server";
import { setSubtaskDone } from "@/lib/db";
import { handle } from "@/lib/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { done } = (await req.json()) as { done?: unknown };
    if (typeof done !== "boolean") return NextResponse.json({ error: "Нужно поле done" }, { status: 400 });
    const subtask = await setSubtaskDone(id, done);
    if (!subtask) return NextResponse.json({ error: "Шаг не найден" }, { status: 404 });
    return NextResponse.json({ subtask });
  } catch (e) {
    return handle(e);
  }
}
