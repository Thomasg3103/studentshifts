import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const cvHeaderBtn = { background: "none", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.4rem", color: "white", fontSize: "0.75rem", fontWeight: "600", padding: "0.25rem 0.6rem", cursor: "pointer", fontFamily: "inherit" };

export function PdfModal({ url, label, fileName, onClose }) {
  const modalRef  = useRef(null);
  const scrollRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [docxHtml, setDocxHtml] = useState(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState(null);

  const ext = (fileName || "").split(".").pop().toLowerCase();
  const isDocx = ext === "docx" || ext === "doc";

  useEffect(() => {
    if (!isDocx || !url) return;
    setDocxLoading(true);
    setDocxError(null);
    (async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const mammoth = (await import("mammoth")).default;
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
        setDocxHtml(value);
      } catch (e) {
        Sentry.captureException(e);
        setDocxError("Could not render document.");
      } finally {
        setDocxLoading(false);
      }
    })();
  }, [url]);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => { document.removeEventListener("fullscreenchange", handler); document.removeEventListener("webkitfullscreenchange", handler); };
  }, []);

  const toggleFullScreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      const el = modalRef.current;
      if (el?.requestFullscreen) el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  const save = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) { Sentry.captureException(e); toast.error("Could not save. Please try again."); }
  };

  const openWith = async () => {
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const mime = isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
        const file = new File([blob], fileName, { type: mime });
        await navigator.share({ files: [file], title: label });
      } catch (e) { if (e.name !== "AbortError") { Sentry.captureException(e); toast.error("Could not share. Please try again."); } }
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  };

  const buttons = [
    { icon: "🖨", label: "Print",       onClick: () => window.print() },
    { icon: "⬇", label: "Save",         onClick: save },
    { icon: "↗", label: "Open With",    onClick: openWith },
    { icon: isFullScreen ? "⊠" : "⛶", label: isFullScreen ? "Exit Full Screen" : "Full Screen", onClick: toggleFullScreen },
    { icon: "✕", label: "Close",        onClick: onClose },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: "1rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)" }}>
      <div ref={modalRef} onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "720px", height: "85vh", display: "flex", flexDirection: "column", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", padding: "0.65rem 1rem", flexShrink: 0 }}>
          <span style={{ color: "white", fontWeight: "700", fontSize: "0.9rem" }}>📄 {label}</span>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {buttons.map(({ icon, label: tip, onClick }) => (
              <div key={tip} style={{ position: "relative", display: "inline-block" }} className="cv-tooltip-wrap">
                <button onClick={onClick} style={cvHeaderBtn}>{icon}</button>
                <span className="cv-tooltip" style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", backgroundColor: "#0f172a", color: "white", fontSize: "0.7rem", fontWeight: "600", padding: "0.2rem 0.5rem", borderRadius: "0.35rem", whiteSpace: "nowrap", pointerEvents: "none", opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", backgroundColor: isDocx ? "white" : "#525659", display: "flex", flexDirection: "column", alignItems: isDocx ? "stretch" : "center", gap: "1rem", padding: "1rem" }}>
          {isDocx && !docxLoading && !docxError && (
            <div style={{ maxWidth: "680px", margin: "0 auto", width: "100%", padding: "0.45rem 0.75rem", backgroundColor: "#fef9c3", border: "1px solid #fde047", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#854d0e", fontWeight: "500" }}>
              ⚠ Formatting may differ from the original — download the file to view it exactly as written.
            </div>
          )}
          {isDocx ? (
            docxLoading ? (
              <p style={{ color: "#64748b", textAlign: "center", marginTop: "2rem" }}>Loading document…</p>
            ) : docxError ? (
              <p style={{ color: "#e11d48", textAlign: "center", marginTop: "2rem" }}>{docxError}</p>
            ) : (
              <div
                dangerouslySetInnerHTML={{ __html: docxHtml || "" }}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.9rem", lineHeight: 1.7, color: "#1e293b", maxWidth: "680px", margin: "0 auto", padding: "1rem" }}
              />
            )
          ) : (
            <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<p style={{ color: "white", marginTop: "2rem" }}>Loading PDF…</p>} error={<p style={{ color: "#fca5a5", marginTop: "2rem" }}>Failed to load PDF.</p>}>
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div key={i + 1} data-page={i + 1}>
                  <Page pageNumber={i + 1} width={Math.min(window.innerWidth - 64, 680)} renderTextLayer={false} />
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
