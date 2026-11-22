import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/db";
import { handle } from "@/lib/http";
import { getOwner } from "@/lib/owner";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const patch: { done?: boolean; quadrant?: "q1" | "q2" | "q3" | "q4"; title?: string; deadline?: string | null } = {};
    if (typeof body.done === "boolean") patch.done = body.done;
    if (typeof body.quadrant === "string" && ["q1", "q2", "q3", "q4"].includes(body.quadrant)) {
      patch.quadrant = body.quadrant as "q1" | "q2" | "q3" | "q4";
    }
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
    if (body.deadline === null || (typeof body.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline))) {
      patch.deadline = body.deadline;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }
    const task = await updateTask(id, patch, await getOwner());
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteTask(id, await getOwner());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
