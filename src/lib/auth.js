// Barrel file: re-exports every function from the individual lib/ modules below, so the
// rest of the app can do `import { signIn, getProfile, uploadAvatar } from "../lib/auth"`
// instead of importing from six different files. No logic lives here — just re-exports.
export * from "./authOps";      // sign up / sign in / sign out / password reset
export * from "./profile";      // load + save the logged-in user's profile (student or company)
export * from "./jobs";         // job posting CRUD (create/edit/delete) + the job feed queries
export * from "./applications"; // a student applying to a job + a company's hiring pipeline
export * from "./admin";        // admin verification queue: approve/reject students & companies
export * from "./uploads";      // file uploads to Supabase Storage (CVs, ID docs, job photos, avatars)
export * from "./messages";     // in-app chat between a student and a company
export * from "./emails";       // transactional email HTML templates + the send-email call
