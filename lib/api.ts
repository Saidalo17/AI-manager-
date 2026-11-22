import type { Quadrant, Subtask, Task } from "./types";

export interface DayAnalysisResult {
  verdict: "overloaded" | "balanced" | "light";
  headline: string;
  advice: string;
  load: { minutes: number; capacity: number; count: number };
  move: { id: string; title: string; reason: string }[];
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data as T;
}

export const api = {
  list: () => req<{ tasks: Task[] }>("/api/tasks").then((r) => r.tasks),
  parse: (text: string, image?: { mimeType: string; data: string }) =>
    req<{ tasks: Task[] }>("/api/tasks/parse", { method: "POST", body: JSON.stringify({ text, image }) }).then((r) => r.tasks),
  update: (id: string, patch: Partial<Pick<Task, "done" | "quadrant" | "title" | "deadline">>) =>
    req<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => req<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  decompose: (id: string) =>
    req<{ subtasks: Subtask[] }>(`/api/tasks/${id}/decompose`, { method: "POST" }).then((r) => r.subtasks),
  analyze: (today: string) =>
    req<DayAnalysisResult>("/api/analyze", { method: "POST", body: JSON.stringify({ today }) }),
  toggleSubtask: (id: string, done: boolean) =>
    req<{ subtask: Subtask }>(`/api/subtasks/${id}`, { method: "PATCH", body: JSON.stringify({ done }) }),
};

export type { Quadrant };
