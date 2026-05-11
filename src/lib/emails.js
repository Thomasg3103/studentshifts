import { supabase } from "./supabase";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail({ to, subject, html, magicLinkEmail, redirectTo }) {
  const { error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, html, magicLinkEmail, redirectTo },
  });
  if (error) throw new Error(error.message || "Email send failed");
}

export function emailStudentApproved(name) {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You're verified! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName}, your identity has been verified and your StudentShifts account is now active.<br/><br/>
              Browse hundreds of flexible student jobs across Ireland and apply in seconds.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Find your Shift →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailCompanyApproved(name, appUrl) {
  const safeName = escapeHtml(name);
  const safeUrl  = /^https?:\/\//i.test(appUrl) ? escapeHtml(appUrl) : '#';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Company verified! ✅</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName}, your company account on StudentShifts has been verified.<br/><br/>
              You can now post job listings and start receiving applications from students across Ireland.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Post a Job →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailApplicantAccepted(studentName, jobTitle, companyName, shift = null) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You got the job! 🎉</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Congratulations ${sName}!<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> has hired you for <strong style="color:#1e293b;">${jTitle}</strong>.<br/>
              Log in to StudentShifts to send a message to your new employer and get started.
            </p>
            ${shift ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background-color:#dcfce7;border:1.5px solid #86efac;border-radius:10px;padding:14px 20px;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;">Your Shift</p><p style="margin:0;font-size:15px;font-weight:700;color:#15803d;">${escapeHtml(shift)}</p></td></tr></table>` : ""}
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(16,185,129,0.4);">
                    Open Messages →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailApplicantDeclined(studentName, jobTitle, companyName, shift = null, remainingShifts = []) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              Thank you for applying for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
              ${shift ? `Unfortunately your application for the <strong style="color:#1e293b;">${escapeHtml(shift)}</strong> shift was unsuccessful.` : "Unfortunately your application was unsuccessful."}
              ${remainingShifts.length ? `<br/><br/>You are still being considered for other available shifts: <strong style="color:#1e293b;">${remainingShifts.map(s => escapeHtml(s)).join(", ")}</strong>.` : ""}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                    ${remainingShifts.length ? "Keep an eye on your StudentShifts account for updates on your remaining applications." : "Good luck with your search! There are plenty more opportunities on StudentShifts."}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailStudentRejected(name) {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Verification update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName},<br/><br/>
              We were unable to verify your StudentShifts student account at this time. This may be because the documents provided were unclear, expired, or did not match our requirements.<br/><br/>
              You can re-submit your documents by logging into your account. If you believe this is an error, please contact us at hello@studentshifts.ie.
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailCompanyRejected(name) {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Company verification update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName},<br/><br/>
              We were unable to verify your company account on StudentShifts at this time. We could not confirm the provided company details against the Companies Registration Office (CRO).<br/><br/>
              If you believe this is an error or would like to provide additional information, please contact us at hello@studentshifts.ie.
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailCompanyInterested(studentName, companyName) {
  const sName = escapeHtml(studentName);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">A company wants to hire you! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> is interested in hiring you and has sent you a message on StudentShifts.<br/><br/>
              Log in to read their message and reply.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Read Message →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">You're receiving this because your profile is visible to verified companies on StudentShifts.</p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailInterviewInvite(studentName, companyName, jobTitle, date, time, note, teamsLink) {
  const sName     = escapeHtml(studentName);
  const cName     = escapeHtml(companyName);
  const jTitle    = jobTitle ? escapeHtml(jobTitle) : "";
  const safeNote  = note ? escapeHtml(note) : "";
  const safeTeams = teamsLink && /^https?:\/\//i.test(teamsLink) ? escapeHtml(teamsLink) : "";
  const whenLine  = date && time ? `${escapeHtml(date)} at ${escapeHtml(time)}`
    : date ? escapeHtml(date)
    : time ? escapeHtml(time)
    : "To be confirmed";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#7c3aed,#A21D54);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You've been invited to interview! 🗓️</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> would like to invite you for an interview${jTitle ? ` for the <strong style="color:#1e293b;">${jTitle}</strong> position` : ""} on StudentShifts.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="background-color:#fce7f3;border:1.5px solid #e9d5ff;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;">Interview Details</p>
                  ${jTitle ? `<p style="margin:0 0 4px;font-size:14px;color:#1e293b;"><strong>Role:</strong> ${jTitle}</p>` : ""}
                  <p style="margin:0 0 4px;font-size:14px;color:#1e293b;"><strong>When:</strong> ${whenLine}</p>
                  ${safeNote ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.5;"><strong>Note from ${cName}:</strong><br/>${safeNote}</p>` : ""}
                  ${safeTeams ? `<p style="margin:10px 0 0;font-size:14px;color:#1e293b;"><strong>Teams Link:</strong> <a href="${safeTeams}" style="color:#A21D54;">${safeTeams}</a></p>` : ""}
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#A21D54);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(124,58,237,0.4);">
                    Open StudentShifts →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailInterviewRejection(studentName, jobTitle, companyName) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Interview update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              Thank you for interviewing for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
              Unfortunately, you have not been selected to progress to the next stage. We appreciate the time you took and encourage you to keep applying — new shifts are posted every day.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Good luck with your search! There are plenty more opportunities on StudentShifts.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailTrialInvite(studentName, companyName, jobTitle, date, time, note) {
  const sName     = escapeHtml(studentName);
  const cName     = escapeHtml(companyName);
  const jTitle    = escapeHtml(jobTitle);
  const safeNote  = note ? escapeHtml(note) : "";
  const whenLine  = date && time ? `${escapeHtml(date)} at ${escapeHtml(time)}`
    : date ? escapeHtml(date)
    : time ? escapeHtml(time)
    : "To be confirmed";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You've been invited to a trial shift! 🎯</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              Great news — <strong style="color:#1e293b;">${cName}</strong> would like to invite you to a trial shift for <strong style="color:#1e293b;">${jTitle}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="background-color:#e0f2fe;border:1.5px solid #bae6fd;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:0.05em;">Trial Shift Details</p>
                  <p style="margin:0 0 4px;font-size:14px;color:#1e293b;"><strong>When:</strong> ${whenLine}</p>
                  ${safeNote ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.5;"><strong>Note from ${cName}:</strong><br/>${safeNote}</p>` : ""}
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(14,165,233,0.4);">
                    Open StudentShifts →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailTrialRejection(studentName, jobTitle, companyName) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              Thank you for completing a trial shift for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
              Unfortunately, your application was unsuccessful on this occasion. We appreciate your effort and encourage you to keep applying — new shifts are posted every day.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Good luck with your search! There are plenty more opportunities on StudentShifts.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
