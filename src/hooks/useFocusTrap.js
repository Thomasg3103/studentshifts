import { useEffect, useRef } from "react";

export function useFocusTrap(ref, onEscape, enabled = true) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement;
    const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = el.querySelectorAll(FOCUSABLE);
    if (focusable.length) focusable[0].focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onEscapeRef.current?.(); return; }
      if (e.key !== "Tab") return;
      const els = Array.from(el.querySelectorAll(FOCUSABLE));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  // onEscape is accessed via ref — only re-run when the modal opens/closes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
