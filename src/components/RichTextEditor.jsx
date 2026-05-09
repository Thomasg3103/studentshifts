import { useRef, useEffect, useCallback, useState } from "react";

export default function RichTextEditor({ value, onChange, placeholder = "Start typing…" }) {
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({});

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  const emit = useCallback(() => {
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const refreshActive = () => {
    const state = {};
    ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"].forEach(f => {
      try { state[f] = document.queryCommandState(f); } catch (_) { state[f] = false; }
    });
    setActiveFormats(state);
  };

  const exec = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    emit();
    refreshActive();
  };

  const isEmpty = !value || value.replace(/<[^>]+>/g, "").trim() === "";

  return (
    <div style={{ border: "1.5px solid #e2e8f0", borderRadius: "0.65rem", overflow: "hidden", backgroundColor: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.5rem 0.75rem", borderBottom: "1.5px solid #e2e8f0", backgroundColor: "#f9fafb", flexWrap: "wrap" }}>
        <ToolBtn cmd="bold" title="Bold" active={activeFormats.bold} onExec={exec} style={{ fontWeight: "800", fontSize: "0.88rem" }}>B</ToolBtn>
        <ToolBtn cmd="italic" title="Italic" active={activeFormats.italic} onExec={exec} style={{ fontStyle: "italic", fontSize: "0.88rem" }}>I</ToolBtn>
        <ToolBtn cmd="underline" title="Underline" active={activeFormats.underline} onExec={exec} style={{ textDecoration: "underline", fontSize: "0.88rem" }}>U</ToolBtn>
        <Sep />
        <ToolBtn cmd="insertUnorderedList" title="Bullet list" active={activeFormats.insertUnorderedList} onExec={exec}><BulletListIcon /></ToolBtn>
        <ToolBtn cmd="insertOrderedList" title="Numbered list" active={activeFormats.insertOrderedList} onExec={exec}><NumberedListIcon /></ToolBtn>
      </div>

      <div style={{ position: "relative" }}>
        {isEmpty && (
          <div style={{ position: "absolute", top: "0.85rem", left: "1rem", color: "#9ca3af", fontSize: "0.9rem", pointerEvents: "none", lineHeight: 1.65, userSelect: "none" }}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onFocus={refreshActive}
          style={{ minHeight: "220px", maxHeight: "400px", overflowY: "auto", padding: "0.85rem 1rem", fontSize: "0.9rem", lineHeight: "1.65", color: "#1e293b", outline: "none", fontFamily: "inherit" }}
        />
      </div>
    </div>
  );
}

function ToolBtn({ cmd, children, title, active, onExec, style = {} }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onExec(cmd); }}
      style={{
        minWidth: "2.1rem", height: "2.1rem",
        border: `1.5px solid ${active ? "#f9a8d4" : "#e2e8f0"}`,
        borderRadius: "0.4rem",
        backgroundColor: active ? "#fdf2f8" : "white",
        color: active ? "#A21D54" : "#374151",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 0.3rem",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: "1px", height: "1.25rem", backgroundColor: "#d1d5db", margin: "0 0.1rem", flexShrink: 0 }} />;
}

function BulletListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.5 3.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0 4a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0 4a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM4 3h10a.5.5 0 0 1 0 1H4a.5.5 0 0 1 0-1zm0 4h10a.5.5 0 0 1 0 1H4a.5.5 0 0 1 0-1zm0 4h10a.5.5 0 0 1 0 1H4a.5.5 0 0 1 0-1z"/>
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3.5h9a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 4h9a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 4h9a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zM1.5 3a.5.5 0 0 1 .5.5v1h.5a.5.5 0 0 1 0 1H1.5a.5.5 0 0 1 0-1H2v-.5A.5.5 0 0 1 1.5 3zM2 6.5H1.5a.5.5 0 0 0 0 1H2v.5a.5.5 0 0 0 1 0V6a.5.5 0 0 0-.5-.5H2zm-.5 3.5a.5.5 0 0 0 0 1H2v.5a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0 0 1H2v.5z"/>
    </svg>
  );
}
