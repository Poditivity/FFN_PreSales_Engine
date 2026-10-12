"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

// pdf.js is large and touches browser-only APIs, so it loads on demand, the first
// time a case study is shown, and never on the server. This is the legacy build,
// which carries the polyfills the standard one leaves out. The standard build
// fails on any browser that lacks newer JavaScript such as Map.getOrInsertComputed,
// and an applicant would see a blank case study instead of the PDF.
let library: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjs() {
  library ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  });
  return library;
}

// One document per link, shared by the card cover and the reader, so opening a
// case study does not download it a second time. A failed load is forgotten so
// a retry can work.
const documents = new Map<string, Promise<PDFDocumentProxy>>();

export function loadPdf(url: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(url);
  if (!doc) {
    doc = pdfjs()
      .then((lib) => lib.getDocument({ url }).promise)
      .catch((error: unknown) => {
        documents.delete(url);
        throw error;
      });
    documents.set(url, doc);
  }
  return doc;
}

/** Draws one page into a canvas at the given CSS width, sharp on high density screens. */
export async function drawPage(doc: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / base.width) * density;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth / base.width) * base.height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
}

/** Width over height of a page, so a page that has not drawn yet holds the right space. */
export async function pageRatio(doc: PDFDocumentProxy, pageNumber: number): Promise<number> {
  const page = await doc.getPage(pageNumber);
  const view = page.getViewport({ scale: 1 });
  return view.width / view.height;
}
