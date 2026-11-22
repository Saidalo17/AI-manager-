export type Quadrant = "q1" | "q2" | "q3" | "q4";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  minutes: number;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  category: string;
  reason: string;
  deadline: string | null; // YYYY-MM-DD
  done: boolean;
  created_at: string;
  subtasks: Subtask[];
}

export const QUADRANTS: {
  id: Quadrant;
  title: string;
  hint: string;
  color: string; // css var name
}[] = [
  { id: "q1", title: "Срочно и важно", hint: "Сделать сейчас", color: "var(--color-neon-pink)" },
  { id: "q2", title: "Важно, но не срочно", hint: "Запланировать", color: "var(--color-neon-cyan)" },
  { id: "q3", title: "Срочно, но не важно", hint: "Делегировать", color: "var(--color-neon-yellow)" },
  { id: "q4", title: "Не срочно и не важно", hint: "Отложить / убрать", color: "var(--color-neon-violet)" },
];
