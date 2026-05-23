import { createClient } from "@/lib/supabase/server";

/**
 * Small reminder strip rendered just below the navbar across the app. Shows
 * the sectors the user marked as "top trending" in Settings. Silent (renders
 * nothing) when the user has no top sectors, isn't signed in, or the column
 * is not yet provisioned.
 */
export async function TopSectorsStrip() {
    const sectors = await fetchTopSectors();
    if (!sectors || sectors.length === 0) return null;

    return (
        <div className="border-b border-[var(--line)] bg-[var(--bg-surface-soft)]">
            <div
                className="mx-auto flex w-full max-w-[min(100%,1400px)] items-center gap-2 overflow-x-auto px-3 py-1.5 sm:px-4 lg:px-6"
                role="region"
                aria-label="Top trending sectors"
            >
                <span
                    aria-hidden
                    className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                >
                    Top sectors
                </span>
                <ul className="flex shrink-0 items-center gap-1.5">
                    {sectors.map((sector) => (
                        <li key={sector}>
                            <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[12px] text-[var(--ink-strong)]">
                                {sector}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

async function fetchTopSectors(): Promise<string[] | null> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from("user_settings")
            .select("top_sectors")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error || !data) return null;

        const raw = (data as { top_sectors?: unknown }).top_sectors;
        if (!Array.isArray(raw)) return null;
        return raw
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((s) => s.length > 0);
    } catch {
        return null;
    }
}
