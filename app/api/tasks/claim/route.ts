import { NextResponse } from "next/server";
import { claimOrphans } from "@/lib/db";
import { handle } from "@/lib/http";
import { getOwner } from "@/lib/owner";

// Забрать себе задачи, созданные до появления разделения по пользователям
export async function POST() {
  try {
    const claimed = await claimOrphans(await getOwner());
    return NextResponse.json({ claimed });
  } catch (e) {
    return handle(e);
  }
}
