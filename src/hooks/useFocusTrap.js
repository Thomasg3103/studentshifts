import { useEffect, useRef } from "react";

/**
 * useFocusTrap — accessibility helper for modals/dialogs.
 *
 * What a "focus trap" is: when a sighted mouse user opens a modal, it's
 * visually obvious the rest of the page is covered and unusable. A keyboard
 * or screen-reader user has no such visual cue — without a focus trap,
 * pressing Tab repeatedly would cycle through buttons/links on the page
 * BEHIND the modal (which they can't even see), letting them "escape" the
 * modal and interact with a part of the page that's supposed to be blocked.
 * A focus trap keeps Tab/Shift+Tab cycling ONLY through the focusable
 * elements inside the modal, looping from the last back to the first (and
 * vice versa) instead of leaking out — this is required for WCAG
 * accessibility compliance on any modal dialog.
 *
 * Usage: call with a ref to the modal's container element, an onEscape
 * callback (closes the modal when Escape is pressed), and an `enabled` flag
 * (typically "is this modal currently open").
 *
 * What it does, step by step:
 *  1. On enable, remembers whatever element had focus before the modal
 *     opened (`prev`), so focus can be restored there when the modal closes
 *     — important so keyboard users don't lose their place in the page.
 *  2. Moves focus to the first focusable element inside the modal.
 *  3. Listens for Tab/Shift+Tab and manually wraps focus: Tab-ing past the
 *     last focusable element jumps back to the first, and Shift+Tab-ing
 *     before the first jumps to the last.
 *  4. Listens for Escape to trigger the caller's onEscape (usually "close
 *     the modal").
 *  5. On cleanup (modal closes/unmounts), removes the listeners and
 *     restores focus to the element remembered in step 1.
 */
export function useFocusTrap(ref, onEscape, enabled = true) {
  // onEscape is stored in a ref (rather than used directly in the effect's
  // dependency array) so that passing a new inline function on every render
  // doesn't tear down and re-attach the trap — the effect only needs to
  // re-run when the modal actually opens or closes (`enabled` changes).
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement;
    // Selector for anything a keyboard user could Tab to — mirrors the
    // built-in browser Tab order (skips disabled fields and anything
    // explicitly removed from the tab order via tabindex="-1").
    const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = el.querySelectorAll(FOCUSABLE);
    if (focusable.length) focusable[0].focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onEscapeRef.current?.(); return; }
      if (e.key !== "Tab") return;
      // Re-query on every Tab press rather than caching `focusable` once —
      // the set of focusable elements can change while the modal is open
      // (e.g. a field becomes enabled, or content loads in).
      const els = Array.from(el.querySelectorAll(FOCUSABLE));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      // This is the actual "trap": intercept Tab at the boundaries and
      // redirect focus to loop within the modal instead of leaving it.
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  // onEscape is accessed via ref — only re-run when the modal opens/closes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
