import { supabase, withTimeout } from "./supabase";

const ALLOWED_DOC_TYPES   = new Set(["pdf", "doc", "docx"]);
const ALLOWED_IMAGE_TYPES = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_DOC_BYTES   = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES =  5 * 1024 * 1024;

// R3-C11: MIME type allowlists — validate the actual file content, not just the extension.
// Renamed shell.exe → shell.pdf has a PDF extension but a PE MIME type.
const ALLOWED_DOC_MIMES   = new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg","image/png","image/webp","image/gif"]);

// Camera-captured photos (input capture="environment") often report an unreliable or
// nonstandard file.type across mobile browsers (e.g. "image/jpg" instead of "image/jpeg").
// Storage uploads must set contentType explicitly from the validated extension so admins
// reviewing verification docs always get a Content-Type the browser can render.
const EXT_TO_CONTENT_TYPE = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function uploadDocument(userId, file, bucket, fileName) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isVerificationDoc = bucket === "verification-docs";
  const allowedExts  = isVerificationDoc ? new Set([...ALLOWED_DOC_TYPES,  ...ALLOWED_IMAGE_TYPES])  : ALLOWED_DOC_TYPES;
  const allowedMimes = isVerificationDoc ? new Set([...ALLOWED_DOC_MIMES, ...ALLOWED_IMAGE_MIMES]) : ALLOWED_DOC_MIMES;
  if (!allowedExts.has(ext))        throw new Error(`File type .${ext} is not allowed. Please upload a PDF${isVerificationDoc ? ", image," : ""} or Word document.`);
  if (!allowedMimes.has(file.type)) throw new Error(`File content type "${file.type}" is not allowed.`);
  if (file.size > MAX_DOC_BYTES) throw new Error("File is too large. Maximum size is 10 MB.");
  const path = `${userId}/${fileName}.${ext}`;
  // Delete old version with a different extension so orphaned files don't accumulate
  const { data: existing } = await supabase.storage.from(bucket).list(userId).catch(() => ({ data: null }));
  if (existing?.length) {
    const toDelete = existing
      .filter(f => f.name.startsWith(fileName + ".") && f.name !== `${fileName}.${ext}`)
      .map(f => `${userId}/${f.name}`);
    if (toDelete.length) await supabase.storage.from(bucket).remove(toDelete).catch(() => {});
  }
  const { error } = await withTimeout(
    supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: EXT_TO_CONTENT_TYPE[ext] }),
    15000, `${fileName} upload timed out — please try again.`
  );
  if (error) throw new Error("Upload failed — please try again.");
  return path;
}

export async function uploadVerificationDocs(userId, studentIdFile, governmentIdFile) {
  const [studentIdPath, govIdPath] = await Promise.all([
    uploadDocument(userId, studentIdFile, "verification-docs", "student_id"),
    uploadDocument(userId, governmentIdFile, "verification-docs", "government_id"),
  ]);
  const { data: updated, error } = await withTimeout(
    supabase.from("students").update({
      student_id_url: studentIdPath,
      gov_id_url: govIdPath,
      status: "pending_review",
    }).eq("id", userId).select("id"),
    10000, "Failed to save document details — please try again."
  );
  if (error || !updated?.length) {
    // Roll back uploaded files — either DB error or no row found to update
    await supabase.storage.from("verification-docs").remove([studentIdPath, govIdPath]).catch(() => {});
    throw error || new Error("Account not found — please sign out, sign back in, and try again.");
  }
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(ext)) throw new Error(`File type .${ext} is not allowed. Please upload a JPG, PNG, WebP or GIF.`);
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) throw new Error(`File content type "${file.type}" is not allowed. Please upload a JPG, PNG, WebP or GIF.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo is too large. Maximum size is 5 MB.");
  const path = `${userId}/avatar.${ext}`;
  // Remove existing avatar files so only one copy exists (different extensions accumulate otherwise)
  const { data: existing } = await supabase.storage.from("avatars").list(userId).catch(() => ({ data: null }));
  if (existing?.length) {
    await supabase.storage.from("avatars").remove(existing.map(f => `${userId}/${f.name}`)).catch(() => {});
  }
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Photo upload timed out — profile saved without new photo."
  );
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
}

export async function uploadCoverPhoto(userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(ext)) throw new Error(`File type .${ext} is not allowed.`);
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) throw new Error(`File content type "${file.type}" is not allowed.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo is too large. Maximum size is 5 MB.");
  const path = `${userId}/cover.${ext}`;
  const { data: existing } = await supabase.storage.from("avatars").list(userId).catch(() => ({ data: null }));
  if (existing?.length) {
    const old = existing.filter(f => f.name.startsWith("cover.")).map(f => `${userId}/${f.name}`);
    if (old.length) await supabase.storage.from("avatars").remove(old).catch(() => {});
  }
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Cover photo upload timed out — please try again."
  );
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
}

export async function getSignedDocumentUrl(bucket, path) {
  let cleanPath = path;
  if (path && path.startsWith("http")) {
    const marker = `/object/public/${bucket}/`;
    const idx = path.indexOf(marker);
    if (idx !== -1) {
      cleanPath = decodeURIComponent(path.slice(idx + marker.length).split("?")[0]);
    }
  }
  // R3-M12: block path traversal sequences before passing to storage API
  if (!cleanPath || /\.\./.test(cleanPath) || cleanPath.startsWith("/")) {
    throw new Error("Invalid document path.");
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 60);
  if (error) throw new Error("Could not load document — please try again.");
  return data.signedUrl;
}
