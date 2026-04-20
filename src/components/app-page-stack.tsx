import type { ComponentPropsWithoutRef } from "react";

/**
 * Vertical rhythm for page sections (title, cards, lists).
 * Use as the outer wrapper for each route’s main content.
 */
export function AppPageStack({
  children,
  className = "",
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={`flex flex-col gap-8 sm:gap-10 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
