// Живые фразы ассистента: разные формулировки, чтобы не звучать как робот

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export const tasksWord = (n: number) => `${n} ${plural(n, "задачу", "задачи", "задач")}`;
const stepsWord = (n: number) => `${n} ${plural(n, "шаг", "шага", "шагов")}`;

export function parsedPhrase(count: number, urgent: number): string {
  const base = pick([
    `Готово. Разобрал, добавил ${tasksWord(count)}.`,
    `Так, всё записал: ${tasksWord(count)}.`,
    `Принято. В списке прибавилось: ${tasksWord(count)}.`,
  ]);
  if (urgent === 0) return base + pick([" Горящих нет, можно выдохнуть.", " Ничего срочного.", ""]);
  if (urgent === 1) return base + pick([" Одна из них горит, начни с неё.", " Одна требует внимания прямо сейчас."]);
  return base + ` Срочных и важных сразу ${urgent}, давай не откладывать.`;
}

export function decomposedPhrase(count: number, first: string): string {
  return (
    pick([`Разбил на ${stepsWord(count)}.`, `Вот план из ${stepsWord(count)}.`, `Получилось ${stepsWord(count)}.`]) +
    ` ${pick(["Начни с первого:", "Для старта:", "Первым делом:"])} ${first}.`
  );
}

export const greetPhrase = () =>
  pick([
    "Привет! Я на связи. Выдели любой текст, и я прочитаю его вслух.",
    "Ассистент включён. Говори, что нужно, а текст на странице я прочитаю, если его выделить.",
  ]);

export function summaryPhrase(total: number, done: number, urgentTitles: string[], openLeft: number): string {
  if (total === 0) return "Пока пусто. Надиктуй или напиши, что нужно сделать, и я всё разложу.";
  let s = `Всего ${tasksWord(total)}, из них сделано ${done}.`;
  if (urgentTitles.length) s += ` Горит: ${urgentTitles.join(", ")}.`;
  else if (openLeft) s += " Срочного нет, самое время заняться важным.";
  else s += " Всё закрыто. Отличная работа!";
  return s;
}
