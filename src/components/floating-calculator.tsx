"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Op = "+" | "−" | "×" | "÷";

function apply(a: number, b: number, op: Op): number {
    switch (op) {
        case "+":
            return a + b;
        case "−":
            return a - b;
        case "×":
            return a * b;
        case "÷":
            return b === 0 ? NaN : a / b;
    }
}

/** Trim floating-point noise and group with thousands separators for display. */
function formatResult(n: number): string {
    if (!Number.isFinite(n)) return "Error";
    const rounded = Number(n.toPrecision(12));
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

export function FloatingCalculator() {
    const [open, setOpen] = useState(false);
    const [display, setDisplay] = useState("0");
    const [previous, setPrevious] = useState<number | null>(null);
    const [operator, setOperator] = useState<Op | null>(null);
    const [overwrite, setOverwrite] = useState(true);
    const wrapRef = useRef<HTMLDivElement>(null);

    const clearAll = useCallback(() => {
        setDisplay("0");
        setPrevious(null);
        setOperator(null);
        setOverwrite(true);
    }, []);

    const inputDigit = useCallback(
        (d: string) => {
            setDisplay((prev) => {
                if (overwrite || prev === "Error") return d;
                if (prev === "0") return d;
                if (prev.replace(/[^0-9]/g, "").length >= 12) return prev;
                return prev + d;
            });
            setOverwrite(false);
        },
        [overwrite],
    );

    const inputDot = useCallback(() => {
        setDisplay((prev) => {
            if (overwrite || prev === "Error") return "0.";
            return prev.includes(".") ? prev : prev + ".";
        });
        setOverwrite(false);
    }, [overwrite]);

    const backspace = useCallback(() => {
        if (overwrite) return;
        setDisplay((prev) => {
            if (prev === "Error") return "0";
            const next = prev.slice(0, -1);
            return next === "" || next === "-" ? "0" : next;
        });
    }, [overwrite]);

    const toggleSign = useCallback(() => {
        setDisplay((prev) => {
            if (prev === "0" || prev === "Error") return prev;
            return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
        });
    }, []);

    const percent = useCallback(() => {
        setDisplay((prev) => {
            const v = Number(prev);
            if (!Number.isFinite(v)) return prev;
            return String(v / 100);
        });
        setOverwrite(true);
    }, []);

    const chooseOperator = useCallback(
        (op: Op) => {
            const current = Number(display);
            if (!Number.isFinite(current)) return;
            if (previous !== null && operator && !overwrite) {
                const result = apply(previous, current, operator);
                setPrevious(result);
                setDisplay(formatResult(result));
            } else if (previous === null) {
                setPrevious(current);
            }
            setOperator(op);
            setOverwrite(true);
        },
        [display, previous, operator, overwrite],
    );

    const equals = useCallback(() => {
        if (operator === null || previous === null) return;
        const current = Number(display);
        const result = apply(previous, current, operator);
        setDisplay(formatResult(result));
        setPrevious(null);
        setOperator(null);
        setOverwrite(true);
    }, [operator, previous, display]);

    // Close on outside click / Escape; keyboard input while open.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            const k = e.key;
            if (k === "Escape") {
                setOpen(false);
                return;
            }
            if (k >= "0" && k <= "9") inputDigit(k);
            else if (k === ".") inputDot();
            else if (k === "+") chooseOperator("+");
            else if (k === "-") chooseOperator("−");
            else if (k === "*") chooseOperator("×");
            else if (k === "/") {
                e.preventDefault();
                chooseOperator("÷");
            } else if (k === "Enter" || k === "=") {
                e.preventDefault();
                equals();
            } else if (k === "Backspace") backspace();
            else if (k === "%") percent();
            else return;
        };
        document.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, inputDigit, inputDot, chooseOperator, equals, backspace, percent]);

    const expr =
        previous !== null && operator ? `${formatResult(previous)} ${operator}` : " ";

    return (
        <div ref={wrapRef} className="fixed bottom-[84px] right-4 z-50 md:bottom-6 md:right-6">
            {open ? (
                <div
                    role="dialog"
                    aria-label="Calculator"
                    className="mb-3 w-[264px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] shadow-[0_12px_32px_rgba(20,18,15,0.30)]"
                >
                    <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
                        <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                            Calculator
                        </span>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close calculator"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--bg-inset)] hover:text-[var(--ink-strong)]"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="px-3 pt-3">
                        <div className="h-4 text-right font-mono text-[12px] tabular-nums text-[var(--ink-faint)]">
                            {expr}
                        </div>
                        <div className="mt-0.5 break-all text-right font-mono text-[26px] leading-tight tabular-nums text-[var(--ink-strong)]">
                            {display}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 p-3">
                        <Key onClick={clearAll} variant="muted">AC</Key>
                        <Key onClick={toggleSign} variant="muted">±</Key>
                        <Key onClick={percent} variant="muted">%</Key>
                        <Key onClick={() => chooseOperator("÷")} variant="op" active={operator === "÷" && overwrite}>÷</Key>

                        <Key onClick={() => inputDigit("7")}>7</Key>
                        <Key onClick={() => inputDigit("8")}>8</Key>
                        <Key onClick={() => inputDigit("9")}>9</Key>
                        <Key onClick={() => chooseOperator("×")} variant="op" active={operator === "×" && overwrite}>×</Key>

                        <Key onClick={() => inputDigit("4")}>4</Key>
                        <Key onClick={() => inputDigit("5")}>5</Key>
                        <Key onClick={() => inputDigit("6")}>6</Key>
                        <Key onClick={() => chooseOperator("−")} variant="op" active={operator === "−" && overwrite}>−</Key>

                        <Key onClick={() => inputDigit("1")}>1</Key>
                        <Key onClick={() => inputDigit("2")}>2</Key>
                        <Key onClick={() => inputDigit("3")}>3</Key>
                        <Key onClick={() => chooseOperator("+")} variant="op" active={operator === "+" && overwrite}>+</Key>

                        <Key onClick={backspace} variant="muted">⌫</Key>
                        <Key onClick={() => inputDigit("0")}>0</Key>
                        <Key onClick={inputDot}>.</Key>
                        <Key onClick={equals} variant="accent">=</Key>
                    </div>
                </div>
            ) : null}

            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Open calculator"
                aria-expanded={open}
                className="ml-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-surface)] text-[var(--ink-strong)] shadow-[0_8px_20px_rgba(20,18,15,0.25)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--bg-inset)]"
            >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="3" width="14" height="18" rx="2" />
                    <path d="M8 7h8" />
                    <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4" />
                </svg>
            </button>
        </div>
    );
}

function Key({
    children,
    onClick,
    variant = "num",
    active = false,
}: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "num" | "op" | "muted" | "accent";
    active?: boolean;
}) {
    const base =
        "flex h-11 items-center justify-center rounded-xl text-[17px] font-medium tabular-nums transition-colors select-none";
    const styles: Record<string, string> = {
        num: "bg-[var(--bg-inset)] text-[var(--ink-strong)] hover:brightness-95 dark:hover:brightness-125",
        muted: "bg-[var(--bg-surface-soft)] text-[var(--ink-muted)] hover:text-[var(--ink-strong)] hover:bg-[var(--bg-inset)]",
        op: active
            ? "bg-[var(--accent-500)] text-white"
            : "bg-[var(--accent-50)] text-[var(--accent-700)] hover:bg-[var(--accent-50)] hover:brightness-95 dark:hover:brightness-125",
        accent: "bg-[var(--accent-700)] text-white hover:bg-[var(--accent-500)]",
    };
    return (
        <button onClick={onClick} className={`${base} ${styles[variant]}`} type="button">
            {children}
        </button>
    );
}
