import type { ComponentPropsWithoutRef } from "react";

type AppPageStackProps = ComponentPropsWithoutRef<"div"> & {
  /** Override default vertical gap between sections (Tailwind classes). */
  gapClass?: string;
};

/**
 * Vertical rhythm for page sections (title, cards, lists).
 * Use as the outer wrapper for each route’s main content.
 */
export function AppPageStack({
  children,
  className = "",
  gapClass = "gap-8 sm:gap-10",
  ...rest
}: AppPageStackProps) {
  return (
    <div className={`flex flex-col ${gapClass} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
