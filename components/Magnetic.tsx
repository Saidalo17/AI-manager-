"use client";

import { useEffect, useRef } from "react";

type Handle = {
  el: HTMLElement;
  radius: number;
  distance: (e: PointerEvent) => number; // расстояние от курсора до края кнопки (0 — курсор над ней)
  pull: (e: PointerEvent) => void;
  release: () => void;
};

// Один общий обработчик: тянется только ближайшая кнопка, соседи не наезжают друг на друга
const handles = new Set<Handle>();
let listening = false;

function onMove(e: PointerEvent) {
  let best: Handle | null = null;
  let bestD = Infinity;
  for (const h of handles) {
    const d = h.distance(e);
    if (d <= h.radius && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  for (const h of handles) (h === best ? h.pull(e) : h.release());
}

function onOut(e: PointerEvent) {
  if (!e.relatedTarget) for (const h of handles) h.release();
}

function register(h: Handle) {
  handles.add(h);
  if (!listening) {
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerout", onOut);
    listening = true;
  }
  return () => {
    handles.delete(h);
    if (handles.size === 0) {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      listening = false;
    }
  };
}

/**
 * Магнитная обёртка: содержимое чуть тянется к курсору и пружинит назад.
 *
 * overwrite — что делать, если курсор вернулся во время анимации «назад»
 *  - "auto"  (по умолчанию): новая анимация перезаписывает текущую и продолжает с её позиции
 *  - "none": пока возврат не закончился, новые движения игнорируются
 *
 * max — максимальное смещение в px (маленькое, чтобы соседние кнопки не перекрывались).
 */
export default function Magnetic({
  children,
  strength = 0.3,
  radius = 24,
  max = 5,
  overwrite = "auto",
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  max?: number;
  overwrite?: "auto" | "none";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;

    let x = 0,
      y = 0,
      tx = 0,
      ty = 0,
      raf = 0,
      inside = false;
    let anim: Animation | null = null;

    const apply = () => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const tick = () => {
      x += (tx - x) * 0.25;
      y += (ty - y) * 0.25;
      apply();
      raf = Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const clamp = (v: number) => Math.max(-max, Math.min(max, v));

    const handle: Handle = {
      el,
      radius,
      distance: (e) => {
        const r = el.getBoundingClientRect();
        const l = r.left - x,
          t = r.top - y;
        const dx = Math.max(l - e.clientX, 0, e.clientX - (l + r.width));
        const dy = Math.max(t - e.clientY, 0, e.clientY - (t + r.height));
        return Math.hypot(dx, dy);
      },
      pull: (e) => {
        if (anim) {
          if (overwrite === "none") return;
          const m = new DOMMatrix(getComputedStyle(el).transform);
          x = m.m41;
          y = m.m42;
          anim.cancel();
          anim = null;
          apply();
        }
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - x;
        const cy = r.top + r.height / 2 - y;
        inside = true;
        tx = clamp((e.clientX - cx) * strength);
        ty = clamp((e.clientY - cy) * strength);
        if (!raf) raf = requestAnimationFrame(tick);
      },
      release: () => {
        if (!inside) return;
        inside = false;
        cancelAnimationFrame(raf);
        raf = 0;
        tx = ty = 0;
        anim = el.animate(
          [{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
          { duration: 500, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        );
        anim.onfinish = () => {
          anim = null;
          x = y = 0;
          el.style.transform = "";
        };
      },
    };

    const unregister = register(handle);
    return () => {
      unregister();
      cancelAnimationFrame(raf);
      anim?.cancel();
    };
  }, [strength, radius, max, overwrite]);

  return (
    <span ref={ref} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </span>
  );
}
