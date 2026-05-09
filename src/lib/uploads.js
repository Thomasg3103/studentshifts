import { supabase, withTimeout } from "./supabase";

const ALLOWED_DOC_TYPES   = new Set(["pdf", "doc", "docx"]);
const ALLOWED_IMAGE_TYPES = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_DOC_BYTES   = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES =  5 * 1024 * 1024;

export async function uploadDocument(userId, file, bucket, fileName) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isVerificationDoc = bucket === "verification-docs";
  const allowedExts = isVerificationDoc ? new Set([...ALLOWED_DOC_TYPES, ...ALLOWED_IMAGE_TYPES]) : ALLOWED_DOC_TYPES;
  if (!allowedExts.has(ext)) throw new Error(`File type .${ext} is not allowed. Please upload a PDF${isVerificationDoc ? ", image," : ""} or Word document.`);
  if (file.size > MAX_DOC_BYTES) throw new Error("File is too large. Maximum size is 10 MB.");
  const path = `${userId}/${fileName}.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from(bucket).upload(path, file, { upsert: true }),
    15000, `${fileName} upload timed out — please try again.`
  );
  if (error) throw error;
  return path;
}

export async function uploadVerificationDocs(userId, studentIdFile, governmentIdFile) {
  const [studentIdPath, govIdPath] = await Promise.all([
    uploadDocument(userId, studentIdFile, "verification-docs", "student_id"),
    uploadDocument(userId, governmentIdFile, "verification-docs", "government_id"),
  ]);
  const { error } = await withTimeout(
    supabase.from("students").update({
      student_id_url: studentIdPath,
      gov_id_url: govIdPath,
      status: "pending_review",
    }).eq("id", userId),
    10000, "Failed to save document details — please try again."
  );
  if (error) throw error;
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(ext)) throw new Error(`File type .${ext} is not allowed. Please upload a JPG, PNG, WebP or GIF.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo is too large. Maximum size is 5 MB.");
  const path = `${userId}/avatar.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Photo upload timed out — profile saved without new photo."
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
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 300);
  if (error) throw new Error(`Could not load document: ${error.message}`);
  return data.signedUrl;
}
