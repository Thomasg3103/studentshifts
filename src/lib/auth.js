import { supabase, withTimeout } from "./supabase";

export async function signUp({ email, password, name, role }) {
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password, options: { data: { name, role } } }),
    15000, "Sign up timed out — please try again."
  );
  if (error) throw error;
  return data.user;
}

export async function signIn({ email, password }) {
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000, "Login timed out — please try again."
  );
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await withTimeout(
    supabase.auth.signOut(),
    10000, "Sign out timed out."
  );
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await withTimeout(
    supabase.from("profiles").select("*, students(*), companies(*)").eq("id", userId).single(),
    10000, "Failed to load profile — please refresh."
  );
  if (error) throw error;
  return data;
}

export async function updateStudentProfile(userId, updates) {
  const { error } = await withTimeout(
    supabase.from("students").update(updates).eq("id", userId),
    10000, "Save timed out — please try again."
  );
  if (error) throw error;
}

// Requires a Supabase SQL function:
//   create or replace function delete_account()
//   returns void language plpgsql security definer as $$
//   begin
//     delete from auth.users where id = auth.uid();
//   end;
//   $$;
export async function deleteAccount() {
  const { error } = await withTimeout(
    supabase.rpc("delete_account"),
    15000, "Account deletion timed out — please try again."
  );
  if (error) throw error;
}

export async function uploadAvatar(userId, file) {
  const ext  = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Photo upload timed out — profile saved without new photo."
  );
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
}
