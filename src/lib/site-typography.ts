/**
 * Shared UI typography — matches body type from the design tokens.
 * Use these for nav + inline links so they never drift to another size.
 */

const uiType = "text-[13px] leading-snug tracking-normal";

/** Header strip: layout + type (pair with active / idle classes). */
export const siteNavLinkBaseClass = `inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 ${uiType} transition-colors sm:px-3.5 sm:py-2`;

export const siteNavLinkActiveClass =
  "bg-[var(--accent-700)] text-white no-underline hover:text-white hover:no-underline";

export const siteNavLinkIdleClass =
  "text-[var(--ink-muted)] no-underline hover:bg-[var(--bg-surface-soft)] hover:text-[var(--ink-strong)]";

const linkType =
  "text-[14px] leading-snug tracking-normal underline-offset-4 hover:underline";

/** In-page text links. */
export const siteTextLinkNeutralClass = `${linkType} text-[var(--ink-strong)]`;

export const siteTextLinkTealClass = `${linkType} text-[var(--accent-700)]`;
