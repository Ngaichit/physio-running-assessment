import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
// Use the legacy build for the widest browser compatibility under Vite.
// `?url` returns a static URL for the worker bundle so we can point pdf.js at it.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Wire up the worker once.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPageRendererProps {
  url: string;
  maxPages?: number;
  scale?: number;
  onPagesRendered?: (base64Pages: string[]) => void;
}

/**
 * Render PDF pages to base64 JPEGs entirely in the browser using pdf.js.
 * Accepts both http(s) URLs and `data:` URLs.
 */
export async function renderPdfToBase64Images(
  url: string,
  scale = 1.5,
  maxPages = 10
): Promise<string[]> {
  const loadingTask = pdfjs.getDocument({
    url,
    isEvalSupported: false,
    disableFontFace: false,
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
    page.cleanup();
  }

  await pdf.destroy();
  return images;
}

export default function PdfPageRenderer({ url, maxPages = 10, onPagesRendered }: PdfPageRendererProps) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderingRef = useRef(false);

  const renderPdf = useCallback(async () => {
    if (renderingRef.current) return;
    renderingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const images = await renderPdfToBase64Images(url, 1.5, maxPages);
      setPageImages(images);
      onPagesRendered?.(images);
    } catch (err: any) {
      console.error("PDF render error:", err);
      setError(err?.message || "Failed to render PDF");
    } finally {
      setLoading(false);
      renderingRef.current = false;
    }
  }, [url, maxPages, onPagesRendered]);

  useEffect(() => {
    if (url) renderPdf();
  }, [url, renderPdf]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Rendering PDF pages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <p>Could not render PDF inline.</p>
        <p className="text-xs mt-1">{error}</p>
        {url.startsWith("http") && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1A6B9C] hover:underline mt-1 inline-block">
            Open PDF in new tab
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pageImages.map((dataUrl, i) => (
        <div key={i} className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b">
            <span className="text-xs text-muted-foreground font-medium">
              Page {i + 1} of {pageImages.length}
            </span>
          </div>
          <img src={dataUrl} alt={`PDF page ${i + 1}`} className="w-full h-auto" style={{ display: "block" }} />
        </div>
      ))}
    </div>
  );
}
