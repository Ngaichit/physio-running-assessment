import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PdfPageRendererProps {
  url: string;
  maxPages?: number;
  scale?: number;
  onPagesRendered?: (base64Pages: string[]) => void;
}

/**
 * Renders PDF pages as images inline using server-side conversion.
 * The server downloads the PDF and converts it to JPEG images using pdftoppm.
 * No browser-side pdfjs needed — just displays <img> tags.
 */
export default function PdfPageRenderer({ url, maxPages = 10, onPagesRendered }: PdfPageRendererProps) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderingRef = useRef(false);

  const pdfToImages = trpc.pdf.toImages.useMutation();

  const renderPdf = useCallback(async () => {
    if (renderingRef.current) return;
    renderingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await pdfToImages.mutateAsync({
        url,
        dpi: 150,
        maxPages,
      });
      setPageImages(result.images);
      onPagesRendered?.(result.images);
    } catch (err: any) {
      console.error("PDF render error:", err);
      setError(err.message || "Failed to render PDF");
    } finally {
      setLoading(false);
      renderingRef.current = false;
    }
  }, [url, maxPages]);

  useEffect(() => {
    if (url) renderPdf();
  }, [url]);

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
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1A6B9C] hover:underline mt-1 inline-block">
          Open PDF in new tab
        </a>
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
          <img
            src={dataUrl}
            alt={`PDF page ${i + 1}`}
            className="w-full h-auto"
            style={{ display: "block" }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Utility: render PDF pages to base64 images for PDF export.
 * Uses the server-side conversion endpoint.
 * Returns empty array on failure (graceful degradation).
 */
export async function renderPdfToBase64Images(url: string, _scale = 2, maxPages = 10): Promise<string[]> {
  try {
    // Call the server API directly (not via tRPC hook, since this is called outside React)
    const resp = await fetch("/api/trpc/pdf.toImages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { url, dpi: 150, maxPages } }),
    });
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    const data = await resp.json();
    return data?.result?.data?.json?.images || [];
  } catch (err) {
    console.error("PDF to base64 render error:", err);
    return [];
  }
}
