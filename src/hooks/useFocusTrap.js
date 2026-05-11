import { useEffect } from "react";

export function useFocusTrap(ref, onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement;
    const focusable = el.querySelectorAll('button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onEscape?.(); return; }
      if (e.key !== "Tab") return;
      const els = Array.from(el.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  // R3-H21: include ref and onEscape so stale closures don't call the wrong handler
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onEscape]);
}
