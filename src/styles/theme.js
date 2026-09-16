/**
 * theme.js — the app's design tokens: a single source of truth for colors,
 * font sizes, spacing, border radius, shadows, and breakpoints.
 *
 * Why this exists: the app uses inline styles (style={{ ... }}) rather than
 * a CSS framework (see CLAUDE.md), which normally makes it easy for colors
 * and spacing to drift — one component using "#B8007A" and another using a
 * slightly different pink by accident. Importing values from this file
 * instead of hardcoding them keeps everything visually consistent and means
 * a brand color change only has to happen in ONE place.
 *
 * Note: many components in this codebase currently use CSS custom properties
 * instead (e.g. `var(--color-brand)`, set up for dark-mode theme switching —
 * see the `darkMode`/`data-theme` logic in StudentShiftsWeb.jsx). This file
 * predates or complements that approach, holding the base palette and scale
 * values as plain JS numbers/strings for places that import them directly
 * rather than through CSS variables.
 */
const theme = {
  colors: {
    // Primary
    magenta: '#B8007A',
    magentaHover: '#6B0047',
    magentaTint: '#F2D6EA',

    // Neutrals
    black: '#1A1A1A',
    white: '#FFFFFF',
    offWhite: '#F7F7F7',
    midGrey: '#9E9E9E',

    // Status
    success: '#00A86B',
    error: '#D9341A',

    // Semantic aliases — same hex values as above, but named by ROLE
    // (primary, textMuted, bgCard...) rather than by literal color name.
    // Prefer using these in components: if the brand color ever changes from
    // magenta to something else, code that referenced `theme.colors.primary`
    // needs no changes, while code that referenced `theme.colors.magenta`
    // would suddenly have a misleading name.
    primary: '#B8007A',
    primaryHover: '#6B0047',
    textPrimary: '#1A1A1A',
    textMuted: '#9E9E9E',
    bgPage: '#F7F7F7',
    bgCard: '#FFFFFF',
    bgTint: '#F2D6EA',
    border: '#9E9E9E',
    footerBg: '#6B0047',
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

    fontSize: {
      display: '3rem',       // 48px — hero
      h1: '2.25rem',         // 36px
      h2: '1.75rem',         // 28px
      h3: '1.375rem',        // 22px
      h4: '1.125rem',        // 18px
      bodyLg: '1.125rem',    // 18px
      body: '1rem',          // 16px
      bodySm: '0.875rem',    // 14px
      caption: '0.75rem',    // 12px
    },

    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    lineHeight: {
      display: 1.1,
      h1: 1.2,
      h2: 1.25,
      h3: 1.3,
      h4: 1.35,
      body: 1.6,
      bodySm: 1.5,
      caption: 1.4,
      button: 1,
    },
  },

  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },

  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },

  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.08)',
    md: '0 4px 12px rgba(0,0,0,0.1)',
    lg: '0 8px 24px rgba(0,0,0,0.12)',
  },

  // Screen-width cutoffs for responsive layout (e.g. "switch to a
  // single-column layout below theme.breakpoints.md").
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
};

export default theme;
