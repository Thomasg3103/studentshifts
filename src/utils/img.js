const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function supabaseImg(url, width, quality = 80) {
  if (!url || !SUPABASE_URL || !url.startsWith(SUPABASE_URL)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${width}&quality=${quality}`;
}
