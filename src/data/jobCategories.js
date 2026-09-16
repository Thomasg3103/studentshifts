/**
 * Shared job categories used across StudentDashboard (filter) and
 * CompanyDashboard (new/edit job form).
 *
 * Structure: { categoryName: [jobTitle, ...] }
 *
 * This is a plain static list (not fetched from Supabase) so that both the
 * "filter by category" UI on the student side and the "pick a job title"
 * dropdown on the company's post-a-job form are always guaranteed to use the
 * exact same set of options — no risk of the two drifting out of sync, and
 * no extra DB round-trip just to populate a dropdown.
 *
 * Special case — "Tutoring": every other category's list is a set of JOB
 * TITLES (e.g. "Barista", "Cashier"). Tutoring's list is actually a set of
 * SCHOOL SUBJECTS (e.g. "Mathematics", "French") because a tutoring "job" is
 * really "tutoring in X subject" — the subject IS the job title for that
 * category. Keep that in mind if you're ever iterating over all categories
 * generically: Tutoring's entries read differently from every other row.
 */
export const jobCategories = {
  "Hospitality": [
    "Bar Staff",
    "Bartender",
    "Waiter",
    "Waitress",
    "Front of House",
    "Host",
    "Hostess",
    "Food Runner",
    "Catering Assistant",
    "Kitchen Staff",
    "Kitchen Porter",
    "Food Prep",
    "Dishwasher",
    "Lounge Staff",
  ],
  "Café & Coffee": [
    "Barista",
    "Café Assistant",
    "Sandwich Artist",
    "Deli Assistant",
  ],
  "Retail": [
    "Retail Assistant",
    "Shop Assistant",
    "Sales Assistant",
    "Cashier",
    "Stockroom Assistant",
    "Stock Clerk",
    "Visual Merchandiser",
    "Fitting Room Assistant",
    "Pharmacy Assistant",
  ],
  "Campus": [
    "Library Assistant",
    "Lab Assistant",
    "Campus Ambassador",
    "Student Tutor",
    "Research Assistant",
    "Admin Assistant",
  ],
  "Service & Reception": [
    "Receptionist",
    "Hotel Receptionist",
    "Customer Service",
    "Call Centre Agent",
    "Concierge",
    "Housekeeper",
    "Cleaner",
    "Laundry Assistant",
  ],
  "Events & Promo": [
    "Event Staff",
    "Promoter",
    "Brand Ambassador",
    "Usher",
    "Box Office",
    "Steward",
  ],
  "Security": [
    "Security Guard",
    "Door Staff",
    "Venue Security",
  ],
  "Delivery & Logistics": [
    "Delivery Driver",
    "Delivery Cyclist",
    "Courier",
    "Warehouse Assistant",
    "Delivery Assistant",
  ],
  "Care": [
    "Childcare Assistant",
    "Crèche Assistant",
    "Care Assistant",
    "Healthcare Support",
    "Support Worker",
  ],
  "Admin & Office": [
    "Office Assistant",
    "Data Entry",
    "Filing Clerk",
    "Receptionist / Admin",
    "Social Media Assistant",
  ],
  "Tutoring": [
    "Mathematics",
    "Applied Mathematics",
    "English",
    "Irish",
    "French",
    "German",
    "Spanish",
    "Italian",
    "Japanese",
    "Mandarin Chinese",
    "Russian",
    "Arabic",
    "Polish",
    "History",
    "Geography",
    "Business",
    "Accounting",
    "Economics",
    "Biology",
    "Chemistry",
    "Physics",
    "Agricultural Science",
    "Agricultural Economics",
    "Computer Science",
    "Home Economics",
    "Music",
    "Art",
    "Design & Communication Graphics",
    "Construction Studies",
    "Engineering",
    "Technology",
    "Physical Education",
    "Politics & Society",
    "Religious Education",
    "Classical Studies",
    "Latin",
    "Ancient Greek",
    "Hebrew Studies",
  ],
};

/**
 * Flat sorted list of all job titles (for search/autocomplete use).
 * Flattens every category's array into one, then dedupes with a Set (in case
 * the same title ever appears under two categories) before alphabetising.
 */
export const allJobTitles = [...new Set(Object.values(jobCategories).flat())].sort();

/**
 * Get the category name for a given job title — the reverse lookup of the
 * jobCategories map above (title -> category, instead of category -> titles).
 * Used so a job's category can be inferred/displayed just from its title.
 */
export function getCategoryForTitle(title) {
  return Object.entries(jobCategories).find(([, titles]) => titles.includes(title))?.[0] ?? null;
}
