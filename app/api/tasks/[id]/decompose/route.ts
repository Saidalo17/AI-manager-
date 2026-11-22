import { NextResponse } from "next/server";
import { getTask, replaceSubtasks } from "@/lib/db";
import { decomposeTask } from "@/lib/gemini";
import { handle } from "@/lib/http";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    const steps = await decomposeTask(task.title, task.category);
    const subtasks = await replaceSubtasks(id, steps);
    return NextResponse.json({ subtasks });
  } catch (e) {
    return handle(e);
  }
}
