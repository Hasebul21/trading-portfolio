import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function nowInDhakaParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const val = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value);
    return { year: val("year"), month: val("month"), day: val("day") };
}

function daysInDhakaMonth(year: number, month1to12: number): number {
    return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function isLastDayInDhaka(): boolean {
    const { year, month, day } = nowInDhakaParts();
    return day === daysInDhakaMonth(year, month);
}

function isCronAuthorized(req: Request): boolean {
    const secret = process.env.DRAFT_MIP_CLEANUP_CRON_SECRET ?? process.env.CRON_SECRET;
    if (!secret) return false;
    const auth = req.headers.get("authorization") ?? "";
    return auth === `Bearer ${secret}`;
}

function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

    if (!url || !serviceRoleKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export async function GET(req: Request) {
    if (!isCronAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isLastDayInDhaka()) {
        return NextResponse.json({ ok: true, skipped: true, reason: "Not last day in Asia/Dhaka" });
    }

    try {
        const supabase = createAdminClient();

        const { count, error } = await supabase
            .from("draft_mip_monthly_headers")
            .delete({ count: "exact" })
            .not("id", "is", null);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ ok: true, deletedHeaders: count ?? 0 });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to clean Draft MIP." },
            { status: 500 },
        );
    }
}