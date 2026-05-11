import { supabase, withTimeout, ensureValidSession } from "./supabase";

export async function getProfilePhotos(userIds) {
  if (!userIds?.length) return {};
  const { data } = await withTimeout(
    supabase.rpc("get_profile_photos", { user_ids: userIds }),
    10000
  ).catch(() => ({ data: [] }));
  return Object.fromEntries((data || []).map(r => [r.id, r.profile_photo_url]));
}

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

export async function fetchMessages(jobId, studentId, companyId = null, { limit = 30, before = null } = {}) {
  await ensureValidSession();
  let query = supabase.from("chat_messages")
    .select("id, sender_id, text, created_at");
  if (jobId === null) {
    query = query.is("job_id", null).eq("student_id", studentId).eq("company_id", companyId);
  } else {
    query = query.eq("job_id", jobId).eq("student_id", studentId);
  }
  if (before) query = query.lt("created_at", before);
  const { data, error } = await withTimeout(
    query.order("created_at", { ascending: false }).limit(limit),
    10000
  );
  if (error) throw error;
  return (data || []).reverse();
}

export async function fetchAllMessagesWithStudent(studentId, companyId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("chat_messages")
      .select("id, sender_id, text, created_at")
      .eq("student_id", studentId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    10000
  );
  if (error) throw error;
  return data || [];
}

export async function sendMessage(jobId, studentId, companyId, senderId, text) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("chat_messages").insert({
      job_id: jobId ?? null, student_id: studentId, company_id: companyId, sender_id: senderId, text,
    }),
    10000
  );
  if (error) throw error;
}

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
