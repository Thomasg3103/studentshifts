// All chat/messaging reads and writes against `chat_messages`. A message thread is
// identified by (job_id, student_id, company_id) — job_id is null for a direct
// message not tied to a specific job posting. Most functions here don't just fetch
// raw messages; they build the "conversation list" views (inbox previews with last
// message + counterpart name/photo) that the UI actually renders, since that data
// doesn't exist as a single table — it's assembled from messages + profiles + jobs.
import { supabase, withTimeout, ensureValidSession } from "./supabase";

// Batch-fetches avatar URLs for a list of user ids in one round trip via RPC, rather
// than each conversation-list function doing its own per-user lookup (which would be
// an N+1 query problem — one request per person instead of one request total).
export async function getProfilePhotos(userIds) {
  if (!userIds?.length) return {};
  const { data } = await withTimeout(
    supabase.rpc("get_profile_photos", { user_ids: userIds }),
    10000
  ).catch(() => ({ data: [] }));
  return Object.fromEntries((data || []).map(r => [r.id, r.profile_photo_url]));
}

// Unread-message badge count. "Unread" here just means "sent by the other party"
// (.neq("sender_id", userId)) — there's no explicit read/unread flag on messages, so
// this approximates it by counting distinct conversation threads that have any
// message not sent by the current user. The Set dedupes so a thread with many
// unread messages still counts as one unread conversation, not one per message.
export async function fetchMessageCount(userId, role) {
  await ensureValidSession();
  if (role === "student") {
    const { data } = await withTimeout(
      supabase.from("chat_messages").select("job_id").eq("student_id", userId).neq("sender_id", userId),
      8000
    ).catch(() => ({ data: [] }));
    return new Set((data || []).map(m => String(m.job_id))).size;
  }
  if (role === "company") {
    const { data } = await withTimeout(
      supabase.from("chat_messages").select("job_id, student_id").eq("company_id", userId).neq("sender_id", userId),
      8000
    ).catch(() => ({ data: [] }));
    return new Set((data || []).map(m => `${m.job_id}_${m.student_id}`)).size;
  }
  return 0;
}

// Fetches one page of a message thread, for both job-scoped chats (jobId given) and
// direct messages (jobId === null). `before` is a cursor for "load older messages"
// pagination — passing the oldest loaded message's timestamp fetches the page before it.
// The query itself orders newest-first (needed so LIMIT grabs the most recent N
// messages, not the oldest N), then .reverse() flips the page back to chronological
// order for rendering top-to-bottom like a normal chat.
export async function fetchMessages(jobId, studentId, companyId = null, { limit = 30, before = null } = {}) {
  await ensureValidSession();
  let query = supabase.from("chat_messages")
    .select("id, sender_id, text, created_at");
  if (jobId === null) {
    query = query.is("job_id", null).eq("student_id", studentId).eq("company_id", companyId);
  } else {
    query = query.eq("job_id", jobId).eq("student_id", studentId);
    if (companyId) query = query.eq("company_id", companyId);
  }
  if (before) query = query.lt("created_at", before);
  const { data, error } = await withTimeout(
    query.order("created_at", { ascending: false }).limit(limit),
    10000
  );
  if (error) throw error;
  return (data || []).reverse();
}

// Loads a company <-> student direct-message thread in full (no pagination cursor,
// just a hard cap) — used when opening a DM conversation, as opposed to fetchMessages
// above which is the paginated version used for job-thread chats.
export async function fetchAllMessagesWithStudent(studentId, companyId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("chat_messages")
      .select("id, sender_id, text, created_at")
      .eq("student_id", studentId)
      .eq("company_id", companyId)
      .is("job_id", null)      // DM context only — exclude job-thread messages
      .order("created_at", { ascending: true })
      .limit(200),             // B5-M13: cap response size
    10000
  );
  if (error) throw error;
  return data || [];
}

export async function sendMessage(jobId, studentId, companyId, senderId, text) {
  await ensureValidSession();
  const { data: inserted, error } = await withTimeout(
    supabase.from("chat_messages").insert({
      job_id: jobId ?? null, student_id: studentId, company_id: companyId, sender_id: senderId, text,
    }).select().single(),
    10000
  );
  if (error) throw error;
  // Whichever side didn't send the message is the recipient — notify them via a push
  // notification Edge Function. This is fire-and-forget (.catch swallows the error
  // and nothing awaits it) so a failed/slow push notification never blocks the
  // message from being sent or shown in the sender's own chat.
  const recipientId = senderId === studentId ? companyId : studentId;
  if (recipientId) {
    supabase.functions.invoke("send-push", {
      body: { user_id: recipientId, title: "New message", body: text.slice(0, 100), url: "/" },
    }).catch(() => {});
  }
  return inserted;
}

// Builds the company's DM inbox list: one row per student they've direct-messaged,
// showing the most recent message. There's no dedicated "conversations" table, so
// this has to fetch ALL direct messages for this company, then reduce them down to
// one (most-recent) entry per student — that's what the lastMsgMap loop below does.
export async function fetchCompanyDirectConversations(companyId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("chat_messages")
      .select("student_id, sender_id, text, created_at")
      .eq("company_id", companyId).is("job_id", null)
      .order("created_at", { ascending: false }),
    10000
  );
  if (error) throw error;
  if (!data?.length) return [];

  const lastMsgMap = {};
  for (const m of data) {
    if (!lastMsgMap[m.student_id]) lastMsgMap[m.student_id] = m;
  }
  const studentIds = Object.keys(lastMsgMap);

  const [{ data: profiles }, photoMap] = await Promise.all([
    withTimeout(supabase.from("profiles").select("id, name").in("id", studentIds), 10000).catch(() => ({ data: [] })),
    getProfilePhotos(studentIds),
  ]);
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));

  return studentIds
    .map(sid => {
      const lm = lastMsgMap[sid];
      return {
        jobId: null, studentId: sid,
        studentName:     nameMap[sid]     || "Student",
        profilePhotoUrl: photoMap[sid]    || null,
        lastMessage:     lm?.text         || null,
        lastMessageAt:   lm?.created_at   || null,
        lastSenderId:    lm?.sender_id    || null,
        title: "Direct Message",
      };
    })
    .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
}

// Student-side mirror of fetchCompanyDirectConversations above: one inbox row per
// company the student has exchanged direct messages with.
export async function fetchStudentDirectConversations(studentId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("chat_messages")
      .select("company_id, sender_id, text, created_at")
      .eq("student_id", studentId).is("job_id", null)
      .order("created_at", { ascending: false }),
    10000
  );
  if (error) throw error;
  if (!data?.length) return [];

  const lastMsgMap = {};
  for (const m of data) {
    if (!lastMsgMap[m.company_id]) lastMsgMap[m.company_id] = m;
  }
  const companyIds = Object.keys(lastMsgMap);

  const [{ data: profiles }, photoMap] = await Promise.all([
    withTimeout(supabase.from("profiles").select("id, name").in("id", companyIds), 10000).catch(() => ({ data: [] })),
    getProfilePhotos(companyIds),
  ]);
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));

  return companyIds
    .map(cid => {
      const lm = lastMsgMap[cid];
      return {
        jobId: null, companyId: cid,
        companyName:     nameMap[cid]   || "Company",
        profilePhotoUrl: photoMap[cid]  || null,
        lastMessage:     lm?.text       || null,
        lastMessageAt:   lm?.created_at || null,
        lastSenderId:    lm?.sender_id  || null,
        title: "Direct Message",
      };
    })
    .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
}

// Builds the company's job-thread inbox: one conversation per (job, accepted
// student) pair. Only Accepted applications are included — companies can only chat
// about a job with students they've actually hired for it, not every applicant, so
// this mirrors the RLS policy that would reject messages to a non-accepted student.
export async function fetchCompanyConversations(companyId) {
  await ensureValidSession();
  const { data: jobs, error: jobsErr } = await withTimeout(
    supabase.from("jobs").select("id, title").eq("company_id", companyId),
    10000
  );
  if (jobsErr) throw jobsErr;
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map(j => j.id);
  const { data: apps, error: appsErr } = await withTimeout(
    supabase.from("applications").select("job_id, student_id").in("job_id", jobIds).eq("status", "Accepted"),
    10000
  );
  if (appsErr) throw appsErr;
  if (!apps || apps.length === 0) return [];

  const studentIds = [...new Set(apps.map(a => a.student_id))];

  const [{ data: profiles }, { data: msgs }, photoMap] = await Promise.all([
    withTimeout(supabase.from("profiles").select("id, name").in("id", studentIds), 10000).catch(() => ({ data: [] })),
    withTimeout(
      supabase.from("chat_messages").select("job_id, student_id, sender_id, text, created_at")
        .in("job_id", jobIds).order("created_at", { ascending: false }),
      10000
    ).catch(() => ({ data: [] })),
    getProfilePhotos(studentIds),
  ]);

  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  const jobMap  = Object.fromEntries(jobs.map(j => [j.id, j]));

  const lastMsgMap = {};
  for (const m of msgs || []) {
    const key = `${m.job_id}_${m.student_id}`;
    if (!lastMsgMap[key]) lastMsgMap[key] = m;
  }

  return apps
    .map(a => {
      const lm = lastMsgMap[`${a.job_id}_${a.student_id}`];
      return {
        jobId:           a.job_id,
        studentId:       a.student_id,
        title:           jobMap[a.job_id]?.title || "Job",
        studentName:     nameMap[a.student_id]   || "Student",
        profilePhotoUrl: photoMap[a.student_id]  || null,
        lastMessage:     lm?.text                || null,
        lastMessageAt:   lm?.created_at          || null,
        lastSenderId:    lm?.sender_id           || null,
      };
    })
    .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
}

// Student-side mirror of fetchCompanyConversations: lists the student's job-thread
// conversations, one per job they were Accepted for.
export async function fetchAcceptedConversations(userId) {
  await ensureValidSession();
  const { data: apps, error: appsErr } = await withTimeout(
    supabase.from("applications").select("job_id").eq("student_id", userId).eq("status", "Accepted"),
    10000
  );
  if (appsErr) throw appsErr;
  if (!apps || apps.length === 0) return [];

  const jobIds = apps.map(a => a.job_id);

  const [{ data: jobs, error: jobsErr }, { data: msgs }] = await Promise.all([
    withTimeout(supabase.from("jobs").select("id, title, company_id").in("id", jobIds), 10000),
    withTimeout(
      supabase.from("chat_messages").select("job_id, sender_id, text, created_at")
        .in("job_id", jobIds).eq("student_id", userId)
        .order("created_at", { ascending: false }),
      10000
    ).catch(() => ({ data: [] })),
  ]);
  if (jobsErr) throw jobsErr;

  const companyIds = [...new Set((jobs || []).map(j => j.company_id))];
  const [{ data: profiles }, photoMap] = await Promise.all([
    withTimeout(supabase.from("profiles").select("id, name").in("id", companyIds), 10000).catch(() => ({ data: [] })),
    getProfilePhotos(companyIds),
  ]);

  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  const jobMap  = Object.fromEntries((jobs || []).map(j => [j.id, j]));

  const lastMsgMap = {};
  for (const m of msgs || []) {
    if (!lastMsgMap[m.job_id]) lastMsgMap[m.job_id] = m;
  }

  return jobIds
    .map(jid => {
      const cid = jobMap[jid]?.company_id || null;
      const lm  = lastMsgMap[jid];
      return {
        jobId:           jid,
        title:           jobMap[jid]?.title || "Job",
        companyId:       cid,
        companyName:     nameMap[cid]       || "Company",
        profilePhotoUrl: photoMap[cid]      || null,
        lastMessage:     lm?.text           || null,
        lastMessageAt:   lm?.created_at     || null,
        lastSenderId:    lm?.sender_id      || null,
      };
    })
    .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
}
