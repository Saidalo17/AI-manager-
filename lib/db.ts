import "server-only";
import { createClient, type Client, type Row } from "@libsql/client";
import type { Quadrant, Subtask, Task } from "./types";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function db(): Client {
  if (client) return client;
  // Поддерживаем и старые имена переменных; лишний "https:" перед libsql:// убираем
  const rawUrl = process.env.TURSO_DATABASE_URL ?? process.env.SUPABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = rawUrl?.trim().replace(/^https?:(?=libsql:)/, "");
  if (!url) throw new Error("Не задан TURSO_DATABASE_URL в .env.local");
  client = createClient({ url, authToken });
  return client;
}

// Схема создаётся автоматически при первом обращении
async function init(): Promise<Client> {
  const c = db();
  ready ??= c
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          quadrant TEXT NOT NULL DEFAULT 'q2' CHECK (quadrant IN ('q1','q2','q3','q4')),
          category TEXT NOT NULL DEFAULT '',
          reason TEXT NOT NULL DEFAULT '',
          deadline TEXT,
          done INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )`,
        `CREATE TABLE IF NOT EXISTS subtasks (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          minutes INTEGER NOT NULL DEFAULT 15,
          done INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0
        )`,
        `CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON subtasks(task_id)`,
      ],
      "write",
    )
    .then(async () => {
      // миграция: владелец задачи (у старых задач его нет — NULL)
      const cols = await c.execute("PRAGMA table_info(tasks)");
      if (!cols.rows.some((r) => String(r.name) === "owner")) {
        await c.execute("ALTER TABLE tasks ADD COLUMN owner TEXT");
      }
      await c.execute("CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(owner)");
    });
  try {
    await ready;
  } catch (e) {
    ready = null;
    throw e;
  }
  return c;
}

const mapSub = (r: Row): Subtask => ({
  id: String(r.id),
  task_id: String(r.task_id),
  title: String(r.title),
  minutes: Number(r.minutes),
  done: Number(r.done) === 1,
  position: Number(r.position),
});

const mapTask = (r: Row, subtasks: Subtask[]): Task => ({
  id: String(r.id),
  title: String(r.title),
  quadrant: String(r.quadrant) as Quadrant,
  category: String(r.category),
  reason: String(r.reason),
  deadline: r.deadline ? String(r.deadline) : null,
  done: Number(r.done) === 1,
  created_at: String(r.created_at),
  subtasks,
});

async function load(owner: string, where = "", args: string[] = []): Promise<Task[]> {
  const c = await init();
  const tasks = await c.execute({
    sql: `SELECT * FROM tasks WHERE owner = ? ${where} ORDER BY created_at DESC, rowid DESC`,
    args: [owner, ...args],
  });
  if (tasks.rows.length === 0) return [];
  const ids = tasks.rows.map((r) => String(r.id));
  const subs = await c.execute({
    sql: `SELECT * FROM subtasks WHERE task_id IN (${ids.map(() => "?").join(",")}) ORDER BY position`,
    args: ids,
  });
  const byTask = new Map<string, Subtask[]>();
  for (const r of subs.rows) {
    const s = mapSub(r);
    byTask.set(s.task_id, [...(byTask.get(s.task_id) ?? []), s]);
  }
  return tasks.rows.map((r) => mapTask(r, byTask.get(String(r.id)) ?? []));
}

export const listTasks = (owner: string) => load(owner);

export async function getTask(id: string, owner: string): Promise<Task | null> {
  return (await load(owner, "AND id = ?", [id]))[0] ?? null;
}

export type NewTask = {
  title: string;
  quadrant: Quadrant;
  category: string;
  reason: string;
  deadline: string | null;
};

export async function insertTasks(items: NewTask[], owner: string): Promise<Task[]> {
  if (items.length === 0) return [];
  const c = await init();
  const ids = items.map(() => crypto.randomUUID());
  await c.batch(
    items.map((t, i) => ({
      sql: "INSERT INTO tasks (id, title, quadrant, category, reason, deadline, owner) VALUES (?,?,?,?,?,?,?)",
      args: [ids[i], t.title, t.quadrant, t.category, t.reason, t.deadline, owner],
    })),
    "write",
  );
  const all = await load(owner, `AND id IN (${ids.map(() => "?").join(",")})`, ids);
  return all;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "done" | "quadrant" | "title" | "deadline">>,
  owner: string,
): Promise<Task | null> {
  const c = await init();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.done !== undefined) (sets.push("done = ?"), args.push(patch.done ? 1 : 0));
  if (patch.quadrant !== undefined) (sets.push("quadrant = ?"), args.push(patch.quadrant));
  if (patch.title !== undefined) (sets.push("title = ?"), args.push(patch.title));
  if (patch.deadline !== undefined) (sets.push("deadline = ?"), args.push(patch.deadline));
  if (sets.length) await c.execute({ sql: `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND owner = ?`, args: [...args, id, owner] });
  return getTask(id, owner);
}

export async function deleteTask(id: string, owner: string): Promise<void> {
  const c = await init();
  await c.batch(
    [
      { sql: "DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE id = ? AND owner = ?)", args: [id, owner] },
      { sql: "DELETE FROM tasks WHERE id = ? AND owner = ?", args: [id, owner] },
    ],
    "write",
  );
}

export async function replaceSubtasks(
  taskId: string,
  items: { title: string; minutes: number }[],
): Promise<Subtask[]> {
  const c = await init();
  const rows = items.map((s, i) => ({ id: crypto.randomUUID(), ...s, position: i }));
  await c.batch(
    [
      { sql: "DELETE FROM subtasks WHERE task_id = ?", args: [taskId] },
      ...rows.map((r) => ({
        sql: "INSERT INTO subtasks (id, task_id, title, minutes, position) VALUES (?,?,?,?,?)",
        args: [r.id, taskId, r.title, r.minutes, r.position],
      })),
    ],
    "write",
  );
  return rows.map((r) => ({ id: r.id, task_id: taskId, title: r.title, minutes: r.minutes, done: false, position: r.position }));
}

export async function setSubtaskDone(id: string, done: boolean, owner: string): Promise<Subtask | null> {
  const c = await init();
  // шаг доступен только владельцу родительской задачи
  const own = "task_id IN (SELECT id FROM tasks WHERE owner = ?)";
  await c.execute({ sql: `UPDATE subtasks SET done = ? WHERE id = ? AND ${own}`, args: [done ? 1 : 0, id, owner] });
  const r = await c.execute({ sql: `SELECT * FROM subtasks WHERE id = ? AND ${own}`, args: [id, owner] });
  return r.rows[0] ? mapSub(r.rows[0]) : null;
}

// ---------- Задачи без владельца (созданы до разделения по пользователям) ----------

export async function countOrphans(): Promise<number> {
  const c = await init();
  const r = await c.execute("SELECT COUNT(*) AS n FROM tasks WHERE owner IS NULL");
  return Number(r.rows[0]?.n ?? 0);
}

/** Передаёт все «ничьи» задачи текущему владельцу (по явной кнопке пользователя) */
export async function claimOrphans(owner: string): Promise<number> {
  const c = await init();
  const r = await c.execute({ sql: "UPDATE tasks SET owner = ? WHERE owner IS NULL", args: [owner] });
  return r.rowsAffected;
}
