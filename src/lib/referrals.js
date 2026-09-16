// Referral system: lets an existing user invite friends with a personal code, and
// lets us track who signed up because of that invite. The heavy lifting (generating
// unique codes, recording a referral, crediting the referrer) happens in Postgres
// RPC functions rather than here, so the logic stays consistent no matter which
// client calls it and can't be bypassed by talking to the DB directly.
import { supabase, withTimeout } from "./supabase";

// Returns the current user's referral code, creating one on first use.
// Codes are stored on the profiles row so they're generated once and reused forever
// (calling this again just returns the same code instead of minting a new one).
export async function getOrCreateReferralCode() {
  // Check if user already has a code
  const { data: profile } = await withTimeout(
    () => supabase.from("profiles").select("referral_code").single(),
    8000
  );
  if (profile?.referral_code) return profile.referral_code;

  // Generate one via RPC
  // generate_referral_code() runs server-side (SQL) so it can guarantee the new
  // code is unique against every other row in one atomic step — doing that check
  // from the client would risk two users racing to grab the same code.
  const { data, error } = await withTimeout(
    () => supabase.rpc("generate_referral_code"),
    8000
  );
  if (error) throw error;
  return data;
}

// Records that `referredEmail` signed up using `referralCode`. Called right after
// a new account is created (e.g. from the signup flow), not by the referrer.
// Silently no-ops with no code — most signups aren't referrals, so this is the
// common path and shouldn't throw for the majority of new users.
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

// Lists referrals made BY the current user. No explicit user filter is needed here —
// RLS on the `referrals` table restricts rows to the caller's own referrals, so this
// query only ever returns what belongs to whoever is logged in.
export async function fetchMyReferrals() {
  const { data, error } = await withTimeout(
    () => supabase.from("referrals").select("id, referred_email, referred_id, created_at").order("created_at", { ascending: false }),
    8000
  );
  if (error) throw error;
  return data || [];
}
