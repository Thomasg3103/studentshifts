import { createContext, useContext } from "react";

/**
 * AppContext — the app-wide "shared state" pipe.
 *
 * React Context exists to avoid "prop drilling": without it, if a
 * deeply-nested component (say, a button three levels down inside
 * StudentDashboard) needed to know who's logged in, every component in
 * between would have to accept and pass through a `currentUser` prop it
 * never actually uses itself, just to relay it downward. Context lets any
 * component skip straight to the data via useApp(), regardless of how deep
 * it sits in the tree.
 *
 * This context is created here as an empty "channel" (default value null),
 * but it's actually FILLED IN by StudentShiftsWeb.jsx — see
 * `appContextValue` and the <AppContext.Provider> in that file. That's the
 * one place responsible for what this context carries. As of writing, the
 * value object includes things like:
 *   - currentUser / setCurrentUser — the logged-in user's profile (or null)
 *   - setPage — legacy page-navigation helper (see PAGE_PATH in StudentShiftsWeb.jsx)
 *   - setSelectedJob — remembers which job was clicked, for the job details page
 *   - likedJobs / appliedJobs (+ their id lists) — a student's saved/applied jobs
 *   - studentLocation — for distance-based job sorting
 *   - appStatuses — live application status per job (Pending/Accepted/Rejected)
 *   - notifCount / msgCount — badge counts shown in the header
 *   - passwordRecoveryMode — gates the /reset-password route
 *   - darkMode / toggleDarkMode — theme toggle
 *
 * Any component can pull this data out with `const { currentUser, ... } =
 * useApp();` instead of receiving it as props. Because this context is only
 * ever given ONE value (created once, near the top of the app), updating any
 * piece of it re-renders every component that calls useApp() and reads that
 * piece — that's the trade-off Context makes vs. prop-passing: simpler
 * wiring, but coarser control over what re-renders.
 */
export const AppContext = createContext(null);

// Convenience hook so components write `useApp()` instead of the more
// verbose `useContext(AppContext)` everywhere.
export function useApp() {
  return useContext(AppContext);
}
