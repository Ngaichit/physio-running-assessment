// Content-Security-Policy directives for the app. Extracted here so they can be
// unit-tested (index.ts self-invokes startServer() on import, so it can't be
// imported from a test).
//
// blob: allowances, one per feature that needs them:
//   - imgSrc     screenshots/PDF pages render as data: URLs; canvas exports are blob:
//   - scriptSrc  pdf.js worker + report print window need blob:; app scripts are bundled
//   - workerSrc  pdf.js spins up its worker from a blob:
//   - mediaSrc   the video editor plays uploaded videos via URL.createObjectURL()
//                (blob: object URLs). Without this, media falls back to default-src
//                'self' and the browser refuses to load the uploaded video.
export const cspDirectives = {
  defaultSrc: ["'self'"],
  // Vite serves inline styles; Google Fonts is used by the report.
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  // Screenshots/PDF pages render as data: URLs; blob: for canvas exports.
  imgSrc: ["'self'", "data:", "blob:"],
  // pdf.js worker + report print window need blob:; scripts are bundled.
  scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
  // fetch(data:) is used to re-encode inline screenshot images with annotations
  connectSrc: ["'self'", "data:"],
  // Uploaded videos play from blob: object URLs in the video editor.
  mediaSrc: ["'self'", "blob:"],
  workerSrc: ["'self'", "blob:"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
} as const;
