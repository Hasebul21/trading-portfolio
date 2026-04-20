"use client";

import { useId } from "react";

export type SymbolFieldInstrument = { symbol: string };

type Props = {
  instruments: SymbolFieldInstrument[];
  /** Shown when the DSE file could not be loaded (optional). */
  loadError?: string | null;
  name?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** Controlled symbol text (when set with `onValueChange`). */
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  /** Tighter input + hint for compact forms. */
  size?: "default" | "sm";
  /** For toolbar layouts without a visible label. */
  "aria-label"?: string;
};

const defaultInputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

const smInputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/**
 * Text input + datalist of DSE trading codes (type to filter in supporting browsers).
 */
export function SymbolField({
  instruments,
  loadError,
  name = "symbol",
  required,
  placeholder = "Type or choose a trading code",
  defaultValue = "",
  value,
  onValueChange,
  onBlur,
  disabled,
  className,
  size = "default",
  "aria-label": ariaLabel,
}: Props) {
  const inputClass =
    className ?? (size === "sm" ? smInputClass : defaultInputClass);
  const rawId = useId().replace(/:/g, "");
  const datalistId = `dse-symbols-${rawId}`;
  const controlled = value !== undefined;

  return (
    <div>
      <input
        type="text"
        name={name}
        aria-label={ariaLabel}
        list={instruments.length > 0 ? datalistId : undefined}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        {...(controlled
          ? {
              value,
              onChange: (e) => onValueChange?.(e.target.value),
              onBlur: () => onBlur?.(),
            }
          : { defaultValue, onBlur: () => onBlur?.() })}
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      {instruments.length > 0 ? (
        <datalist id={datalistId}>
          {instruments.map((i) => (
            <option key={i.symbol} value={i.symbol} />
          ))}
        </datalist>
      ) : null}
      {loadError ? (
        <p className="mt-1 text-[15px] font-normal leading-snug text-amber-800 dark:text-amber-200/90">
          {size === "sm"
            ? "Symbol list offline — type code manually."
            : `Could not load the DSE symbol list (${loadError}). You can still type a trading code manually.`}
        </p>
      ) : null}
    </div>
  );
}
