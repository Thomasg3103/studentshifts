/**
 * img.js — helper for resizing/compressing images served from Supabase Storage.
 *
 * Supabase's image storage CDN supports on-the-fly transforms via query
 * string parameters (?width=...&quality=...) — it resizes and re-compresses
 * the image server-side and caches the result, so instead of always shipping
 * a full-resolution photo (which could be several MB) to every device, a
 * small thumbnail-sized version can be requested for e.g. a job card, while
 * the full-size photo is still used on a detail page. This keeps page loads
 * fast and saves bandwidth for the user, especially on mobile.
 *
 * `width` sets the max width in pixels to resize to; `quality` (0-100,
 * default 80) controls JPEG/WebP compression — 80 is a common sweet spot
 * between visibly-sharp and file-size-small.
 */
export function supabaseImg(url, width, quality = 80) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  // Guard: only rewrite URLs that actually point at OUR Supabase project.
  // Without this, calling supabaseImg() on an already-external or missing
  // URL (e.g. a placeholder image, or a photo hosted elsewhere) would either
  // do nothing useful or append meaningless query params to someone else's
  // URL — so it's returned untouched instead.
  if (!url || !baseUrl || !url.startsWith(baseUrl)) return url;
  // If the URL already has query params (rare, but possible), append with
  // "&" instead of clobbering them by starting a new "?".
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${width}&quality=${quality}`;
}
