/**
 * Shared UI typography — matches `body` / Ant token: 15px, Geist, weight 400.
 * Use these for nav + inline links so they never drift to another size.
 */

const uiType = "text-[15px] font-normal leading-snug tracking-normal";

/** Header strip: layout + type (pair with active / idle classes). */
export const siteNavLinkBaseClass =
  `inline-flex items-center justify-center rounded-lg px-3 py-2 ${uiType} transition duration-200 sm:px-3.5 sm:py-2.5`;

export const siteNavLinkActiveClass =
  "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 ring-1 ring-white/25 no-underline hover:text-white hover:no-underline dark:from-teal-500 dark:to-emerald-500 dark:shadow-teal-950/50";

export const siteNavLinkIdleClass =
  "text-zinc-600 no-underline underline-offset-4 hover:bg-white/90 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-50";

const linkType =
  "text-[15px] font-normal leading-snug tracking-normal underline-offset-4 hover:underline";

/** In-page text links (login/register, empty states, helper copy). */
export const siteTextLinkNeutralClass = `${linkType} text-zinc-900 dark:text-zinc-100`;

export const siteTextLinkTealClass = `${linkType} text-teal-800 dark:text-teal-300`;
