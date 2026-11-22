// Перетаскивание карточки между квадрантами: работает и мышью, и пальцем (pointer events).
import type { Quadrant } from "./types";

export const DND_EVENT = "dnd-over";

export function startCardDrag(
  e: React.PointerEvent,
  card: HTMLElement,
  onDrop: (q: Quadrant) => void,
  current: Quadrant,
) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  e.preventDefault();

  const rect = card.getBoundingClientRect();
  const dx = e.clientX - rect.left;
  const dy = e.clientY - rect.top;

  const ghost = card.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    zIndex: "90",
    pointerEvents: "none",
    opacity: "0.95",
    transform: "rotate(2deg) scale(1.02)",
    boxShadow: "0 20px 50px -12px rgb(91 91 240 / .55)",
    transition: "none",
  });
  document.body.appendChild(ghost);
  card.style.opacity = "0.3";
  document.body.style.userSelect = "none";

  let x = e.clientX;
  let y = e.clientY;
  let over: Quadrant | null = null;

  const setOver = (q: Quadrant | null) => {
    if (q === over) return;
    over = q;
    window.dispatchEvent(new CustomEvent(DND_EVENT, { detail: q }));
  };

  const update = () => {
    ghost.style.left = `${x - dx}px`;
    ghost.style.top = `${y - dy}px`;
    const el = document.elementFromPoint(x, y);
    const q = el?.closest<HTMLElement>("[data-quadrant]")?.dataset.quadrant as Quadrant | undefined;
    setOver(q ?? null);
  };

  // автопрокрутка у верхнего и нижнего края экрана
  const scroller = setInterval(() => {
    const edge = 80;
    if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 6));
    else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge)) / 6));
    else return;
    update();
  }, 16);

  const move = (ev: PointerEvent) => {
    x = ev.clientX;
    y = ev.clientY;
    update();
  };
  const finish = (commit: boolean) => {
    clearInterval(scroller);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    ghost.remove();
    card.style.opacity = "";
    document.body.style.userSelect = "";
    const target = over;
    setOver(null);
    if (commit && target && target !== current) onDrop(target);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  update();
}
