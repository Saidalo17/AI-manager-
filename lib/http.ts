import { NextResponse } from "next/server";

export function handle(e: unknown) {
  const message = e instanceof Error ? e.message : "Внутренняя ошибка";
  console.error("[api]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}
