import type { Quadrant, Subtask, Task } from "./types";

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
  update: (id: string, patch: Partial<Pick<Task, "done" | "quadrant" | "title">>) =>
    req<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => req<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  decompose: (id: string) =>
    req<{ subtasks: Subtask[] }>(`/api/tasks/${id}/decompose`, { method: "POST" }).then((r) => r.subtasks),
  toggleSubtask: (id: string, done: boolean) =>
    req<{ subtask: Subtask }>(`/api/subtasks/${id}`, { method: "PATCH", body: JSON.stringify({ done }) }),
};

export type { Quadrant };
