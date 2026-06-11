"use client";

import { signOut } from "../actions";
import {
    updatePortfolioReportEmail,
    updateUserPassword,
    updateUserProfile,
} from "../settings-actions";
import { sendPortfolioEmailWithUserSettings } from "./settings-actions";
import type { CashAdjustmentRow, UserSettings } from "../settings-actions";
import type { SectorTargetWithCurrent } from "../sector-target-actions";
import type { SectorInvestmentRow } from "@/lib/sector-investments";
import type { SellPlanRow } from "@/lib/sell-plans";
import type { SymbolFieldInstrument } from "@/components/symbol-field";
import { CashAdjustmentsForm } from "./cash-adjustments-form";
import { PositionsCashForm } from "./positions-cash-form";
import { SectorInvestmentsForm } from "./sector-investments-form";
import { SectorTargetsForm } from "./sector-targets-form";
import { SellPlansForm } from "./sell-plans-form";
import { TopSectorsForm } from "./top-sectors-form";
import {
    Icons,
    SCard,
    SCardBody,
    SCardHead,
    SErr,
    SOk,
    SWarn,
} from "./settings-ui";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import "./settings.css";

type TabKey =
    | "profile"
    | "password"
    | "targets"
    | "monthly"
    | "sell"
    | "topsectors"
    | "cash"
    | "positions-cash"
    | "email";

type NavItem = { key: TabKey; label: string; icon: ReactNode; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

export function SettingsForm({
    initialSettings,
    initialSectorTargets,
    sectorTargetsError,
    initialSectorInvestments,
    sectorInvestmentsError,
    initialSellPlans,
    sellPlansError,
    sellPlanInstruments,
    sellPlanInstrumentsError,
    initialCashAdjustments,
    initialCashAdjustmentsTotal,
    cashAdjustmentsError,
}: {
    initialSettings: UserSettings;
    initialSectorTargets: SectorTargetWithCurrent[];
    sectorTargetsError: string | null;
    initialSectorInvestments: SectorInvestmentRow[];
    sectorInvestmentsError: string | null;
    initialSellPlans: SellPlanRow[];
    sellPlansError: string | null;
    sellPlanInstruments: SymbolFieldInstrument[];
    sellPlanInstrumentsError: string | null;
    initialCashAdjustments: CashAdjustmentRow[];
    initialCashAdjustmentsTotal: number;
    cashAdjustmentsError: string | null;
}) {
    const [activeTab, setActiveTab] = useState<TabKey>("profile");
    const [query, setQuery] = useState("");

    const groups: NavGroup[] = useMemo(
        () => [
            {
                label: "Account",
                items: [
                    { key: "profile", label: "Profile", icon: Icons.profile(18) },
                    { key: "password", label: "Password", icon: Icons.password(18) },
                ],
            },
            {
                label: "Portfolio strategy",
                items: [
                    { key: "targets", label: "Sector targets", icon: Icons.targets(18), badge: initialSectorTargets.length || undefined },
                    { key: "monthly", label: "Monthly investment", icon: Icons.monthly(18) },
                    { key: "sell", label: "Sell plan", icon: Icons.sell(18), badge: initialSellPlans.length || undefined },
                    { key: "topsectors", label: "Top sectors", icon: Icons.topsectors(18) },
                    { key: "cash", label: "Cash adjustments", icon: Icons.cash(18) },
                    { key: "positions-cash", label: "Positions cash", icon: Icons.positions(18) },
                ],
            },
            {
                label: "Notifications",
                items: [{ key: "email", label: "Email & reports", icon: Icons.email(18) }],
            },
        ],
        [initialSectorTargets.length, initialSellPlans.length],
    );

    const q = query.trim().toLowerCase();
    const filteredGroups = useMemo(
        () =>
            groups
                .map((g) => ({ ...g, items: g.items.filter((it) => !q || it.label.toLowerCase().includes(q)) }))
                .filter((g) => g.items.length > 0),
        [groups, q],
    );

    return (
        <div className="settings-rd">
            <div className="page-head">
                <p className="eyebrow">Account &amp; preferences</p>
                <h1 className="page-h1">Settings</h1>
                <p className="page-sub">
                    Manage your profile, security, portfolio strategy, and how reports reach you.
                </p>
            </div>

            <div className="settings">
                <aside className="side">
                    <div className="search">
                        {Icons.search(16)}
                        <input
                            type="text"
                            placeholder="Search settings…"
                            autoComplete="off"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <nav>
                        {filteredGroups.map((group) => (
                            <div className="navgroup" key={group.label}>
                                <p className="navgroup-label">{group.label}</p>
                                {group.items.map((it) => (
                                    <button
                                        key={it.key}
                                        className={`sidelink ${activeTab === it.key ? "active" : ""}`}
                                        onClick={() => setActiveTab(it.key)}
                                    >
                                        <span className="si">{it.icon}</span>
                                        <span className="sl-label">{it.label}</span>
                                        {it.badge ? <span className="sl-badge">{it.badge}</span> : null}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </nav>

                    {filteredGroups.length === 0 ? (
                        <p className="no-results" style={{ display: "block" }}>
                            No settings match your search.
                        </p>
                    ) : null}

                    <div className="side-foot logout-block">
                        <form action={signOut}>
                            <button className="btn btn-default" style={{ width: "100%" }} type="submit">
                                Log out
                            </button>
                        </form>
                    </div>
                </aside>

                <section className="content">
                    <Panel active={activeTab === "profile"}>
                        <ProfilePanel initialSettings={initialSettings} />
                    </Panel>

                    <Panel active={activeTab === "password"}>
                        <PasswordPanel />
                    </Panel>

                    <Panel active={activeTab === "targets"}>
                        {sectorTargetsError ? (
                            <SCard>
                                <SCardHead tone="loss" icon={Icons.targets()} title="Could not load sector targets" />
                                <SCardBody>
                                    <SErr>{sectorTargetsError}</SErr>
                                </SCardBody>
                            </SCard>
                        ) : (
                            <SectorTargetsForm initialRows={initialSectorTargets} />
                        )}
                    </Panel>

                    <Panel active={activeTab === "monthly"}>
                        {sectorInvestmentsError ? (
                            <SCard>
                                <SCardHead tone="loss" icon={Icons.monthly()} title="Could not load monthly investments" />
                                <SCardBody>
                                    <SErr>{sectorInvestmentsError}</SErr>
                                </SCardBody>
                            </SCard>
                        ) : (
                            <SectorInvestmentsForm initialRows={initialSectorInvestments} />
                        )}
                    </Panel>

                    <Panel active={activeTab === "sell"}>
                        {sellPlansError ? (
                            <SCard>
                                <SCardHead tone="loss" icon={Icons.sell()} title="Could not load sell plan" />
                                <SCardBody>
                                    <SErr>{sellPlansError}</SErr>
                                </SCardBody>
                            </SCard>
                        ) : (
                            <SellPlansForm
                                initialRows={initialSellPlans}
                                instruments={sellPlanInstruments}
                                instrumentsLoadError={sellPlanInstrumentsError}
                            />
                        )}
                    </Panel>

                    <Panel active={activeTab === "topsectors"}>
                        <TopSectorsForm
                            initialSectors={initialSettings.top_sectors}
                            suggestions={initialSectorTargets.map((r) => r.sector)}
                        />
                    </Panel>

                    <Panel active={activeTab === "cash"}>
                        <CashAdjustmentsForm
                            initialRows={initialCashAdjustments}
                            initialTotal={initialCashAdjustmentsTotal}
                            initialError={cashAdjustmentsError}
                        />
                    </Panel>

                    <Panel active={activeTab === "positions-cash"}>
                        <PositionsCashForm initialBalance={initialSettings.positions_balance_bdt ?? 0} />
                    </Panel>

                    <Panel active={activeTab === "email"}>
                        <EmailPanel initialEmail={initialSettings.portfolio_report_email} />
                    </Panel>
                </section>
            </div>
        </div>
    );
}

function Panel({ active, children }: { active: boolean; children: ReactNode }) {
    return <div className={`panel ${active ? "active" : ""}`}>{children}</div>;
}

/* ── Profile ────────────────────────────────────────────────────────────── */

function ProfilePanel({ initialSettings }: { initialSettings: UserSettings }) {
    const [fullName, setFullName] = useState(initialSettings.full_name || "");
    const [commissionRate, setCommissionRate] = useState(
        initialSettings.trade_commission_rate != null ? String(initialSettings.trade_commission_rate) : "",
    );
    const [currency, setCurrency] = useState(initialSettings.currency || "BDT");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const save = useCallback(async () => {
        setError(null);
        setOk(false);
        setSaving(true);
        try {
            const res = await updateUserProfile(fullName, commissionRate.trim() || null, currency);
            if (!res.ok) setError(res.error);
            else {
                setOk(true);
                setTimeout(() => setOk(false), 3000);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save profile");
        } finally {
            setSaving(false);
        }
    }, [fullName, commissionRate, currency]);

    return (
        <SCard>
            <SCardHead
                tone="acc"
                icon={Icons.profile()}
                title="Profile"
                desc="Your display name and trade defaults used across the app."
            />
            <SCardBody>
                <div className="field">
                    <label className="lbl">Full name</label>
                    <input
                        className="inp"
                        value={fullName}
                        onChange={(e) => {
                            setFullName(e.target.value);
                            setError(null);
                            setOk(false);
                        }}
                        placeholder="Your full name"
                    />
                </div>
                <div className="field">
                    <label className="lbl">Trade commission rate (optional)</label>
                    <p className="hint">Enter as a decimal (e.g. 0.004 for 0.4%).</p>
                    <input
                        className="inp mono"
                        style={{ maxWidth: 220 }}
                        value={commissionRate}
                        onChange={(e) => {
                            setCommissionRate(e.target.value);
                            setError(null);
                            setOk(false);
                        }}
                        placeholder="0.004"
                        inputMode="decimal"
                    />
                </div>
                <div className="field">
                    <label className="lbl">Currency</label>
                    <input
                        className="inp mono"
                        style={{ maxWidth: 120 }}
                        value={currency}
                        onChange={(e) => {
                            setCurrency(e.target.value);
                            setError(null);
                            setOk(false);
                        }}
                        maxLength={3}
                        placeholder="BDT"
                    />
                </div>
                <div className="btn-row">
                    <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
                        {saving ? "Saving…" : "Save profile"}
                    </button>
                </div>
                {error ? <SErr>{error}</SErr> : null}
                {ok ? <SOk>Profile updated successfully.</SOk> : null}
            </SCardBody>
        </SCard>
    );
}

/* ── Password ───────────────────────────────────────────────────────────── */

function PasswordPanel() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const change = useCallback(async () => {
        setError(null);
        setOk(false);
        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }
        setSaving(true);
        try {
            const res = await updateUserPassword(currentPassword, newPassword);
            if (!res.ok) setError(res.error);
            else {
                setOk(true);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setTimeout(() => setOk(false), 3000);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to change password");
        } finally {
            setSaving(false);
        }
    }, [currentPassword, newPassword, confirmPassword]);

    return (
        <SCard>
            <SCardHead
                tone="loss"
                icon={Icons.password()}
                title="Password"
                desc="Choose a strong password you don't use anywhere else."
            />
            <SCardBody>
                <div className="field">
                    <label className="lbl">Current password</label>
                    <input
                        className="inp"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            setError(null);
                            setOk(false);
                        }}
                        placeholder="Enter your current password"
                    />
                </div>
                <div className="grid2">
                    <div className="field" style={{ marginBottom: 0 }}>
                        <label className="lbl">New password</label>
                        <input
                            className="inp"
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setError(null);
                                setOk(false);
                            }}
                            placeholder="Min 6 characters"
                        />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                        <label className="lbl">Confirm new password</label>
                        <input
                            className="inp"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setError(null);
                                setOk(false);
                            }}
                            placeholder="Re-enter new password"
                        />
                    </div>
                </div>
                <div className="btn-row">
                    <button
                        className="btn btn-danger"
                        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                        onClick={() => void change()}
                    >
                        {saving ? "Saving…" : "Change password"}
                    </button>
                </div>
                {error ? <SErr>{error}</SErr> : null}
                {ok ? <SOk>Password changed successfully.</SOk> : null}
            </SCardBody>
        </SCard>
    );
}

/* ── Email & reports ────────────────────────────────────────────────────── */

function EmailPanel({ initialEmail }: { initialEmail: string }) {
    const [reportEmail, setReportEmail] = useState(initialEmail);
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [emailOk, setEmailOk] = useState(false);

    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sendOk, setSendOk] = useState(false);

    const saveEmail = useCallback(async () => {
        setEmailError(null);
        setEmailOk(false);
        setSavingEmail(true);
        try {
            const res = await updatePortfolioReportEmail(reportEmail);
            if (!res.ok) setEmailError(res.error);
            else {
                setEmailOk(true);
                setTimeout(() => setEmailOk(false), 3000);
            }
        } catch (e) {
            setEmailError(e instanceof Error ? e.message : "Failed to save email");
        } finally {
            setSavingEmail(false);
        }
    }, [reportEmail]);

    const send = useCallback(async () => {
        setSendError(null);
        setSendOk(false);
        setSending(true);
        try {
            const res = await sendPortfolioEmailWithUserSettings();
            if (!res.ok) setSendError(res.error);
            else {
                setSendOk(true);
                setTimeout(() => setSendOk(false), 3000);
            }
        } catch (e) {
            setSendError(e instanceof Error ? e.message : "Failed to send email");
        } finally {
            setSending(false);
        }
    }, []);

    return (
        <>
            <SCard>
                <SCardHead
                    tone="warn"
                    icon={Icons.email()}
                    title="Portfolio report email"
                    desc="Where manual portfolio reports are sent."
                />
                <SCardBody>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div className="field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
                            <label className="lbl">Email address</label>
                            <input
                                className="inp"
                                type="email"
                                value={reportEmail}
                                onChange={(e) => {
                                    setReportEmail(e.target.value);
                                    setEmailError(null);
                                    setEmailOk(false);
                                }}
                                placeholder="email@example.com"
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            disabled={savingEmail || reportEmail === initialEmail}
                            onClick={() => void saveEmail()}
                        >
                            {savingEmail ? "Saving…" : "Save email"}
                        </button>
                    </div>
                    {emailError ? <SErr>{emailError}</SErr> : null}
                    {emailOk ? <SOk>Report email updated.</SOk> : null}
                </SCardBody>
            </SCard>

            <SCard>
                <SCardHead
                    tone="acc"
                    icon={Icons.delivery()}
                    title="Delivery"
                    desc={
                        <>
                            Reports are sent automatically{" "}
                            <span style={{ color: "var(--ink-strong)" }}>every day at 5:00 PM Bangladesh time</span>{" "}
                            (Asia/Dhaka, UTC+6). The address above only controls the manual “Send report now” button.
                        </>
                    }
                />
                <SCardBody>
                    <button className="btn btn-primary" disabled={sending} onClick={() => void send()}>
                        {sending ? "Sending…" : "Send report now"}
                    </button>
                    <div className="notice">
                        <b>Vercel-friendly email setup.</b> This app uses Resend instead of SMTP. Set{" "}
                        <code>RESEND_API_KEY</code> in Vercel Project Settings to enable sending. <code>RESEND_FROM</code> is
                        optional.
                    </div>
                    <SWarn title="Automatic daily reports">
                        Cron runs daily at 11:00 UTC (5:00 PM Asia/Dhaka). Requires <code>CRON_SECRET</code>,{" "}
                        <code>RESEND_API_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, and a matching{" "}
                        <code>PORTFOLIO_REPORT_RECIPIENT</code>.
                    </SWarn>
                    {sendError ? <SErr>{sendError}</SErr> : null}
                    {sendOk ? <SOk>Portfolio report sent successfully.</SOk> : null}
                </SCardBody>
            </SCard>
        </>
    );
}
