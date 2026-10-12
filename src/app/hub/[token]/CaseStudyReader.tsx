"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronDown, ChevronUp, Download, ExternalLink, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { caseStudySource, driveEmbedUrl } from "@/lib/content/casePdf";
import type { HubCaseStudyItem } from "@/lib/hubs/publicHub";
import { drawPage, loadPdf, pageRatio } from "./pdf";

export type TrackFn = (type: string, targetType?: string, targetId?: string, meta?: Record<string, unknown>) => void;

const ZOOMS = [1, 1.25, 1.5, 2] as const;
// A page wider than this stops being comfortable to read on a wide screen.
const MAX_FIT_WIDTH = 880;
const PROGRESS_EVERY_SECONDS = 10;
const MAX_PAGES = 200;

function PdfPage({
  doc,
  number,
  width,
  ratio,
  root,
}: {
  doc: PDFDocumentProxy;
  number: number;
  width: number;
  ratio: number;
  root: HTMLElement | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(number <= 2);

  // A page draws only while it is near the screen and is cleared when it is
  // far away, so a long report never holds every page in memory at once.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: "900px 0px 900px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let cancelled = false;
    drawPage(doc, number, canvas, width).catch(() => {
      // A page that fails to draw stays blank. The rest of the document still reads.
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [doc, number, width, near]);

  return (
    <div ref={wrapRef} className="rd-page" data-page={number} style={{ width, height: width / ratio }}>
      <canvas ref={canvasRef} aria-label={`Page ${number}`} role="img" />
    </div>
  );
}

export function CaseStudyReader({
  item,
  track,
  flush,
  onClose,
}: {
  item: HubCaseStudyItem;
  track: TrackFn;
  flush: () => void;
  onClose: () => void;
}) {
  const link = item.case_study_link;
  const source = caseStudySource(link);
  const embed = source === "drive" && link ? driveEmbedUrl(link) : null;
  const mode: "pdf" | "drive" | "none" = source === "pdf" ? "pdf" : embed ? "drive" : "none";

  const [full, setFull] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(mode === "pdf" ? "loading" : mode === "drive" ? "ready" : "error");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratios, setRatios] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [fit, setFit] = useState(0);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const regionRef = useRef<HTMLElement>(null);

  const numPages = ratios.length;
  const zoom = ZOOMS[zoomIndex];
  const pageWidth = Math.max(0, Math.round(Math.min(fit, MAX_FIT_WIDTH) * zoom));
  const hasPages = pageWidth > 0;

  // ---- Load the document ----
  useEffect(() => {
    if (mode !== "pdf" || !link) return;
    let cancelled = false;
    loadPdf(link)
      .then(async (loaded) => {
        const count = Math.min(loaded.numPages, MAX_PAGES);
        const sizes = await Promise.all(Array.from({ length: count }, (_, i) => pageRatio(loaded, i + 1)));
        if (cancelled) return;
        setDoc(loaded);
        setRatios(sizes);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, link]);

  // ---- Fit the page to the space it has ----
  useEffect(() => {
    if (!scrollEl) return;
    const measure = () => {
      const style = getComputedStyle(scrollEl);
      const inner = scrollEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFit(Math.max(0, Math.floor(inner)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [scrollEl, full]);

  // ---- Reading measurement ----
  // Everything below is what the team sees later: which pages were actually in
  // the reading band, how long the reader stayed with the tab visible, and
  // whether they reached the end. Each open of a case study has its own id so
  // the numbers of one sitting are not mixed with another.
  const [openId] = useState(() => crypto.randomUUID());
  const seen = useRef(new Set<number>());
  const seconds = useRef(0);
  const completed = useRef(false);
  const opened = useRef(false);
  const lastSent = useRef("");

  const send = useCallback(
    (now = false) => {
      const signature = `${seconds.current}:${seen.current.size}`;
      if (signature === lastSent.current || (seconds.current === 0 && seen.current.size === 0)) return;
      lastSent.current = signature;
      track("pdf_progress", "case_studies", item.id, {
        open_id: openId,
        source: mode,
        seconds: seconds.current,
        pages_seen: seen.current.size,
        max_page: seen.current.size ? Math.max(...seen.current) : 0,
        pages: mode === "pdf" ? numPages : null,
      });
      if (now) flush();
    },
    [track, flush, item.id, openId, mode, numPages],
  );
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Opened. Counted once the content is really on screen, not when the click landed.
  useEffect(() => {
    if (phase !== "ready" || opened.current) return;
    opened.current = true;
    track("pdf_open", "case_studies", item.id, { open_id: openId, source: mode, pages: mode === "pdf" ? numPages : null });
  }, [phase, track, item.id, openId, mode, numPages]);

  // Time with the reader open and the tab in view.
  useEffect(() => {
    if (phase !== "ready") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds.current += 1;
      if (seconds.current % PROGRESS_EVERY_SECONDS === 0) sendRef.current();
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") sendRef.current(true);
    };
    const onPageHide = () => sendRef.current(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      sendRef.current(true);
    };
  }, [phase]);

  // Pages in the middle band of the reading area count as read. A page that
  // only crosses the edge while someone scrolls past does not.
  useEffect(() => {
    if (!scrollEl || phase !== "ready" || mode !== "pdf" || numPages === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const n = Number((entry.target as HTMLElement).dataset.page);
          if (n) seen.current.add(n);
        }
        if (!completed.current && seen.current.has(numPages) && numPages > 1) {
          completed.current = true;
          track("pdf_complete", "case_studies", item.id, { open_id: openId, pages: numPages });
        }
      },
      { root: scrollEl, rootMargin: "-30% 0px -30% 0px", threshold: 0 },
    );
    // The pages exist only once the width is known, so this waits for them and
    // attaches again if the size changes. What was already seen is kept.
    scrollEl.querySelectorAll("[data-page]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollEl, phase, mode, numPages, hasPages, track, item.id, openId]);

  // The page number in the toolbar follows the page across the middle of the reading area.
  useEffect(() => {
    if (!scrollEl || mode !== "pdf" || numPages === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight / 2;
      let current = 1;
      scrollEl.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
        if (el.getBoundingClientRect().top <= middle) current = Number(el.dataset.page);
      });
      setPage(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollEl, mode, numPages]);

  function goTo(n: number) {
    const target = scrollEl?.querySelector<HTMLElement>(`[data-page="${Math.min(Math.max(n, 1), numPages)}"]`);
    if (!target || !scrollEl) return;
    scrollEl.scrollTo({ top: target.offsetTop - scrollEl.offsetTop, behavior: "auto" });
  }

  // ---- Screen behaviour ----
  useEffect(() => {
    regionRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [full]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A founder drawer opened over the reader takes the key first.
      if (document.querySelector(".dr-root")) return;
      if (full) setFull(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, onClose]);

  const founders = item.founders.map((f) => f.name).join(", ");

  return (
    <section
      ref={regionRef}
      tabIndex={-1}
      id="case-reader"
      className={`rd${full ? " rd--full" : ""}`}
      role={full ? "dialog" : "region"}
      aria-modal={full ? true : undefined}
      aria-label={`Case study: ${item.title}`}
    >
      <header className="rd-bar">
        <div className="rd-title">
          <p className="rd-name">{item.title}</p>
          {founders && <p className="rd-sub">{founders}</p>}
        </div>
        <div className="rd-tools">
          {mode === "pdf" && numPages > 0 && (
            <>
              <span className="rd-count data-sm" aria-live="polite">
                {page} of {numPages}
              </span>
              <button type="button" className="rd-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                <ChevronUp size={16} strokeWidth={1.75} />
              </button>
              <button type="button" className="rd-btn" aria-label="Next page" disabled={page >= numPages} onClick={() => goTo(page + 1)}>
                <ChevronDown size={16} strokeWidth={1.75} />
              </button>
              <span className="rd-sep" aria-hidden="true" />
              <button
                type="button"
                className="rd-btn"
                aria-label="Zoom out"
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              >
                <ZoomOut size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="rd-btn"
                aria-label="Zoom in"
                disabled={zoomIndex === ZOOMS.length - 1}
                onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
              >
                <ZoomIn size={16} strokeWidth={1.75} />
              </button>
              <span className="rd-sep" aria-hidden="true" />
            </>
          )}
          {link && (
            <a
              className="rd-btn"
              href={link}
              target="_blank"
              rel="noreferrer"
              aria-label={mode === "drive" ? "Open in Google Drive" : "Download PDF"}
              {...(mode === "pdf" ? { download: "" } : {})}
              onClick={() => track("pdf_download", "case_studies", item.id, { open_id: openId })}
            >
              {mode === "drive" ? <ExternalLink size={16} strokeWidth={1.75} /> : <Download size={16} strokeWidth={1.75} />}
            </a>
          )}
          <button type="button" className="rd-btn" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((v) => !v)}>
            {full ? <Minimize2 size={16} strokeWidth={1.75} /> : <Maximize2 size={16} strokeWidth={1.75} />}
          </button>
          <button type="button" className="rd-btn" aria-label="Close case study" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="rd-body">
        {mode === "drive" && embed && (
          <iframe className="rd-frame" src={embed} title={item.title} allow="autoplay" onLoad={() => setPhase("ready")} />
        )}

        {mode === "pdf" && phase === "ready" && doc && (
          <div className="rd-scroll" ref={setScrollEl} tabIndex={0} aria-label={`${item.title}, ${numPages} pages`}>
            {pageWidth > 0 &&
              ratios.map((ratio, i) => (
                <PdfPage key={i} doc={doc} number={i + 1} width={pageWidth} ratio={ratio} root={scrollEl} />
              ))}
          </div>
        )}

        {mode === "pdf" && phase === "loading" && (
          <div className="rd-state" role="status">
            <span className="rd-spinner" aria-hidden="true" />
            <p>Opening the case study</p>
          </div>
        )}

        {(phase === "error" || mode === "none") && (
          <div className="rd-state" role="alert">
            <p className="rd-state-title">This case study could not be shown here.</p>
            <p>You can still open the PDF on its own.</p>
            {link && (
              <a
                className="hub-btn hub-btn--primary"
                href={link}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("pdf_download", "case_studies", item.id, { open_id: openId })}
              >
                Open the PDF
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
