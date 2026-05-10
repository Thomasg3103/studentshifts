import { supabase, withTimeout, invalidateSessionCache } from "./supabase";

export async function signUp({ email, password, name, role, croNumber, industries }) {
  if (role !== 'student' && role !== 'company') throw new Error('Invalid role');
  const meta = { name, role };
  if (role === "company" && croNumber) meta.cro_number = croNumber.trim();
  if (role === "company" && industries?.length) meta.industries = industries;
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password, options: { data: meta } }),
    15000, "Sign up timed out — please try again."
  );
  if (error) throw error;
  return data.user;
}

export async function signIn({ email, password }) {
  invalidateSessionCache();
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000, "Login timed out — please try again."
  );
  if (error) {
    if (error.message?.toLowerCase().includes("email not confirmed"))
      throw new Error("Please verify your email before logging in. Check your inbox for the confirmation link.");
    throw error;
  }
  return data.user;
}

export async function signOut() {
  invalidateSessionCache();
  const { error } = await withTimeout(
    supabase.auth.signOut(),
    10000, "Sign out timed out."
  );
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const { error } = await withTimeout(
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    }),
    15000, "Password reset timed out — please try again."
  );
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await withTimeout(
    supabase.auth.updateUser({ password: newPassword }),
    15000, "Password update timed out — please try again."
  );
  if (error) throw error;
}

export async function resendVerificationEmail(email) {
  const { error } = await withTimeout(
    supabase.auth.resend({ type: "signup", email }),
    15000, "Resend timed out — please try again."
  );
  if (error) throw error;
}

export async function verifyPassword(email, password) {
  const { error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000, "Verification timed out."
  );
  if (error) throw new Error("Incorrect password");
}
