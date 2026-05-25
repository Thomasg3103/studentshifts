import { supabase, withTimeout } from "./supabase";

export async function getOrCreateReferralCode() {
  // Check if user already has a code
  const { data: profile } = await withTimeout(
    () => supabase.from("profiles").select("referral_code").single(),
    8000
  );
  if (profile?.referral_code) return profile.referral_code;

  // Generate one via RPC
  const { data, error } = await withTimeout(
    () => supabase.rpc("generate_referral_code"),
    8000
  );
  if (error) throw error;
  return data;
}

export async function trackReferral(referralCode, referredEmail) {
  if (!referralCode) return;
  await withTimeout(
    () => supabase.rpc("track_referral", {
      p_referral_code: referralCode,
      p_referred_email: referredEmail,
    }),
    8000
  );
}

export async function fetchMyReferrals() {
  const { data, error } = await withTimeout(
    () => supabase.from("referrals").select("id, referred_email, referred_id, created_at").order("created_at", { ascending: false }),
    8000
  );
  if (error) throw error;
  return data || [];
}
