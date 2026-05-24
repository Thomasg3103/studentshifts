export function supabaseImg(url, width, quality = 80) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!url || !baseUrl || !url.startsWith(baseUrl)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${width}&quality=${quality}`;
}
