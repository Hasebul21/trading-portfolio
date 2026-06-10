"use client";

import { signOut } from "../actions";
import { updatePortfolioReportEmail, updateUserProfile, updateUserPassword } from "../settings-actions";
import { sendPortfolioEmailWithUserSettings } from "./settings-actions";
import type { CashAdjustmentRow, UserSettings } from "../settings-actions";
import type { SectorTargetWithCurrent } from "../sector-target-actions";
import type { SectorInvestmentRow } from "@/lib/sector-investments";
import type { SellPlanRow } from "@/lib/sell-plans";
import type { SymbolFieldInstrument } from "@/components/symbol-field";
import { CashAdjustmentsForm } from "./cash-adjustments-form";
import { SectorInvestmentsForm } from "./sector-investments-form";
import { SectorTargetsForm } from "./sector-targets-form";
import { SellPlansForm } from "./sell-plans-form";
import { TopSectorsForm } from "./top-sectors-form";
import { Alert, Button, Card, Input, InputNumber, Tabs } from "antd";
import { useCallback, useState } from "react";

type TabKey =
 | "profile"
 | "email"
 | "password"
 | "targets"
 | "monthly-investment"
 | "sell-plan"
 | "top-sectors"
 | "cash";

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

 // Profile state
 const [fullName, setFullName] = useState(initialSettings.full_name || "");
 const [commissionRate, setCommissionRate] = useState<number | null>(
 initialSettings.trade_commission_rate || null,
 );
 const [currency, setCurrency] = useState(initialSettings.currency || "BDT");
 const [profileSaving, setProfileSaving] = useState(false);
 const [profileError, setProfileError] = useState<string | null>(null);
 const [profileOk, setProfileOk] = useState(false);

 // Email state
 const [reportEmail, setReportEmail] = useState(initialSettings.portfolio_report_email);
 const [reportSaving, setReportSaving] = useState(false);
 const [reportError, setReportError] = useState<string | null>(null);
 const [reportOk, setReportOk] = useState(false);

 // Password state
 const [currentPassword, setCurrentPassword] = useState("");
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [passwordSaving, setPasswordSaving] = useState(false);
 const [passwordError, setPasswordError] = useState<string | null>(null);
 const [passwordOk, setPasswordOk] = useState(false);
 const [sendingEmail, setSendingEmail] = useState(false);
 const [sendError, setSendError] = useState<string | null>(null);
 const [sendOk, setSendOk] = useState(false);

 const handleSaveProfile = useCallback(async () => {
 setProfileError(null);
 setProfileOk(false);
 setProfileSaving(true);
 try {
 const res = await updateUserProfile(fullName, commissionRate?.toString() || null, currency);
 if (!res.ok) {
 setProfileError(res.error);
 } else {
 setProfileOk(true);
 setTimeout(() => setProfileOk(false), 3000);
 }
 } catch (e) {
 setProfileError(e instanceof Error ? e.message : "Failed to save profile");
 } finally {
 setProfileSaving(false);
 }
 }, [fullName, commissionRate, currency]);

 const handleSaveReportEmail = useCallback(async () => {
 setReportError(null);
 setReportOk(false);
 setReportSaving(true);
 try {
 const res = await updatePortfolioReportEmail(reportEmail);
 if (!res.ok) {
 setReportError(res.error);
 } else {
 setReportOk(true);
 setTimeout(() => setReportOk(false), 3000);
 }
 } catch (e) {
 setReportError(e instanceof Error ? e.message : "Failed to save email");
 } finally {
 setReportSaving(false);
 }
 }, [reportEmail]);

 const handleChangePassword = useCallback(async () => {
 setPasswordError(null);
 setPasswordOk(false);

 if (newPassword !== confirmPassword) {
 setPasswordError("New passwords do not match.");
 return;
 }

 setPasswordSaving(true);
 try {
 const res = await updateUserPassword(currentPassword, newPassword);
 if (!res.ok) {
 setPasswordError(res.error);
 } else {
 setPasswordOk(true);
 setCurrentPassword("");
 setNewPassword("");
 setConfirmPassword("");
 setTimeout(() => setPasswordOk(false), 3000);
 }
 } catch (e) {
 setPasswordError(e instanceof Error ? e.message : "Failed to change password");
 } finally {
 setPasswordSaving(false);
 }
 }, [currentPassword, newPassword, confirmPassword]);

 const handleSendEmail = useCallback(async () => {
 setSendError(null);
 setSendOk(false);
 setSendingEmail(true);
 try {
 const res = await sendPortfolioEmailWithUserSettings();
 if (!res.ok) {
 setSendError(res.error);
 } else {
 setSendOk(true);
 setTimeout(() => setSendOk(false), 3000);
 }
 } catch (e) {
 setSendError(e instanceof Error ? e.message : "Failed to send email");
 } finally {
 setSendingEmail(false);
 }
 }, []);

 return (
 <div className="space-y-4">
 <Tabs
 activeKey={activeTab}
 onChange={(key) => setActiveTab(key as TabKey)}
 items={[
 {
 key: "profile",
 label: "Profile",
 children: (
 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-4">
 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Full Name
 </label>
 <Input
 value={fullName}
 onChange={(e) => {
 setFullName(e.target.value);
 setProfileError(null);
 setProfileOk(false);
 }}
 placeholder="Your full name"
 size="large"
 className="mt-2 rounded-md"
 />
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Trade Commission Rate (optional)
 </label>
 <p className="text-[12px] text-[var(--ink-muted)]">
 Enter as decimal (e.g., 0.004 for 0.4%)
 </p>
 <InputNumber
 value={commissionRate}
 onChange={(val) => {
 setCommissionRate(val);
 setProfileError(null);
 setProfileOk(false);
 }}
 placeholder="0.004"
 step={0.001}
 min={0}
 max={1}
 size="large"
 className="mt-2 w-full rounded-md"
 />
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Currency
 </label>
 <Input
 value={currency}
 onChange={(e) => {
 setCurrency(e.target.value);
 setProfileError(null);
 setProfileOk(false);
 }}
 placeholder="BDT"
 size="large"
 className="mt-2 rounded-md"
 maxLength={3}
 />
 </div>

 <Button
 type="primary"
 size="large"
 loading={profileSaving}
 disabled={profileSaving}
 onClick={() => void handleSaveProfile()}
 className="mt-4"
 >
 Save Profile
 </Button>

 {profileError && (
 <Alert type="error" showIcon message="Error" description={profileError} />
 )}
 {profileOk && (
 <Alert
 type="success"
 showIcon
 message="Success"
 description="Profile updated successfully."
 />
 )}
 </div>
 </Card>
 ),
 },
 {
 key: "email",
 label: "Email & Reports",
 children: (
 <div className="space-y-5">
 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-4">
 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Portfolio Report Email
 </label>
 <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
 Where portfolio reports will be sent
 </p>
 </div>

 <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
 <div className="flex-1">
 <Input
 type="email"
 value={reportEmail}
 onChange={(e) => {
 setReportEmail(e.target.value);
 setReportError(null);
 setReportOk(false);
 }}
 placeholder="email@example.com"
 size="large"
 className="rounded-md"
 />
 </div>
 <Button
 type="primary"
 size="large"
 loading={reportSaving}
 disabled={reportSaving || reportEmail === initialSettings.portfolio_report_email}
 onClick={() => void handleSaveReportEmail()}
 className="whitespace-nowrap"
 >
 Save Email
 </Button>
 </div>

 {reportError && (
 <Alert type="error" showIcon message="Error" description={reportError} />
 )}
 {reportOk && (
 <Alert
 type="success"
 showIcon
 message="Success"
 description="Report email updated."
 />
 )}
 </div>
 </Card>

 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-4">
 <div>
 <h3 className="text-[14px] text-[var(--ink-strong)]">Delivery</h3>
 <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
 Reports are sent automatically{" "}
 <span className="text-[var(--ink-strong)]">every day at 5:00 PM Bangladesh time</span>{" "}
 (Asia/Dhaka, UTC+6).
 </p>
 <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
 Recipient for the automated job is configured in Vercel as{" "}
 <span className="text-[var(--ink-strong)]">PORTFOLIO_REPORT_RECIPIENT</span>{" "}
 — the address above only controls the manual “Send Report Now” button.
 </p>
 </div>
 <div>
 <Button
 type="primary"
 size="large"
 loading={sendingEmail}
 disabled={sendingEmail}
 onClick={() => void handleSendEmail()}
 >
 Send Report Now
 </Button>
 </div>
 {sendError ? <Alert type="error" showIcon message="Error" description={sendError} /> : null}
 {sendOk ? (
 <Alert
 type="success"
 showIcon
 message="Success"
 description="Portfolio report sent successfully."
 />
 ) : null}
 </div>
 </Card>

 <div className="rounded-lg border border-[var(--accent-200)] bg-[var(--accent-50)] px-4 py-3">
 <p className="text-[13px] text-[var(--accent-700)]">Vercel-friendly email setup</p>
 <p className="mt-1 text-[12px] text-[var(--accent-700)]">
 This app now uses Resend instead of SMTP. Set only{" "}
 <span className="text-[var(--accent-700)]">RESEND_API_KEY</span> in Vercel Project
 Settings to enable sending. <span className="text-[var(--accent-700)]">RESEND_FROM</span>{" "}
 is optional.
 </p>
 </div>

 <div className="rounded-lg border border-[var(--warn-200)] bg-[var(--warn-50)] px-4 py-3">
 <p className="text-[13px] text-[var(--warn-700)]">Automatic daily reports</p>
 <p className="mt-1 text-[12px] text-[var(--warn-700)]">
 Cron runs daily at 11:00 UTC (5:00 PM Asia/Dhaka). Requires{" "}
 <span className="text-[var(--warn-700)]">CRON_SECRET</span>,{" "}
 <span className="text-[var(--warn-700)]">RESEND_API_KEY</span>,{" "}
 <span className="text-[var(--warn-700)]">SUPABASE_SERVICE_ROLE_KEY</span>, and a{" "}
 <span className="text-[var(--warn-700)]">PORTFOLIO_REPORT_RECIPIENT</span>{" "}
 that matches an existing Supabase auth user.
 </p>
 </div>
 </div>
 ),
 },
 {
 key: "targets",
 label: "Sector targets",
 children: sectorTargetsError ? (
 <Alert
 type="error"
 showIcon
 message="Could not load sector targets"
 description={sectorTargetsError}
 />
 ) : (
 <SectorTargetsForm initialRows={initialSectorTargets} />
 ),
 },
 {
 key: "monthly-investment",
 label: "Monthly investment",
 children: sectorInvestmentsError ? (
 <Alert
 type="error"
 showIcon
 message="Could not load monthly investments"
 description={sectorInvestmentsError}
 />
 ) : (
 <SectorInvestmentsForm initialRows={initialSectorInvestments} />
 ),
 },
 {
 key: "sell-plan",
 label: "Sell plan",
 children: sellPlansError ? (
 <Alert
 type="error"
 showIcon
 message="Could not load sell plan"
 description={sellPlansError}
 />
 ) : (
 <SellPlansForm
 initialRows={initialSellPlans}
 instruments={sellPlanInstruments}
 instrumentsLoadError={sellPlanInstrumentsError}
 />
 ),
 },
 {
 key: "top-sectors",
 label: "Top sectors",
 children: (
 <TopSectorsForm
 initialSectors={initialSettings.top_sectors}
 suggestions={initialSectorTargets.map((r) => r.sector)}
 />
 ),
 },
 {
 key: "cash",
 label: "Cash adjustments",
 children: (
 <CashAdjustmentsForm
 initialRows={initialCashAdjustments}
 initialTotal={initialCashAdjustmentsTotal}
 initialError={cashAdjustmentsError}
 />
 ),
 },
 {
 key: "password",
 label: "Password",
 children: (
 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-4">
 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Current Password
 </label>
 <Input.Password
 value={currentPassword}
 onChange={(e) => {
 setCurrentPassword(e.target.value);
 setPasswordError(null);
 setPasswordOk(false);
 }}
 placeholder="Enter your current password"
 size="large"
 className="mt-2 rounded-md"
 />
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 New Password
 </label>
 <Input.Password
 value={newPassword}
 onChange={(e) => {
 setNewPassword(e.target.value);
 setPasswordError(null);
 setPasswordOk(false);
 }}
 placeholder="Enter new password (min 6 characters)"
 size="large"
 className="mt-2 rounded-md"
 />
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Confirm New Password
 </label>
 <Input.Password
 value={confirmPassword}
 onChange={(e) => {
 setConfirmPassword(e.target.value);
 setPasswordError(null);
 setPasswordOk(false);
 }}
 placeholder="Confirm new password"
 size="large"
 className="mt-2 rounded-md"
 />
 </div>

 <Button
 type="primary"
 danger
 size="large"
 loading={passwordSaving}
 disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
 onClick={() => void handleChangePassword()}
 className="mt-4"
 >
 Change Password
 </Button>

 {passwordError && (
 <Alert type="error" showIcon message="Error" description={passwordError} />
 )}
 {passwordOk && (
 <Alert
 type="success"
 showIcon
 message="Success"
 description="Password changed successfully."
 />
 )}
 </div>
 </Card>
 ),
 },
 ]}
 />

 {/*
 Mobile log-out — the desktop header keeps its own button, so this only
 renders on `< md` where the header is minimal.
 */}
 <form action={signOut} className="md:hidden">
 <Button danger type="default" htmlType="submit" size="large" block>
 Log out
 </Button>
 </form>
 </div>
 );
}
