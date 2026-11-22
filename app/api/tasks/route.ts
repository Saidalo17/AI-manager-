import { NextResponse } from "next/server";
import { countOrphans, listTasks } from "@/lib/db";
import { handle } from "@/lib/http";
import { getOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await getOwner();
    const [tasks, orphans] = await Promise.all([listTasks(owner), countOrphans()]);
    return NextResponse.json({ tasks, orphans });
  } catch (e) {
    return handle(e);
  }
}
