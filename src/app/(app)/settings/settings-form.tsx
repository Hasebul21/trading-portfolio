"use client";

import { updatePortfolioReportEmail, updateUserProfile, updateUserPassword, updateUserEmail } from "../settings-actions";
import { sendPortfolioEmailWithUserSettings } from "./settings-actions";
import type { UserSettings } from "../settings-actions";
import { Alert, Button, Card, Input, InputNumber, Space, Tabs } from "antd";
import { useCallback, useState } from "react";

type TabKey = "profile" | "email" | "password" | "reports";

export function SettingsForm({ initialSettings }: { initialSettings: UserSettings }) {
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

  // Send email state
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
              className="rounded-xl border-teal-200/50 bg-white/75 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/65"
              styles={{ body: { padding: "16px 24px" } }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
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
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
                    Trade Commission Rate (optional)
                  </label>
                  <p className="text-[13px] font-normal text-zinc-600 dark:text-zinc-400">
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
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
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
                className="rounded-xl border-teal-200/50 bg-white/75 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/65"
                styles={{ body: { padding: "16px 24px" } }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
                      Portfolio Report Email
                    </label>
                    <p className="mt-1 text-[13px] font-normal text-zinc-600 dark:text-zinc-400">
                      Where monthly portfolio reports will be sent
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
                className="rounded-xl border-teal-200/50 bg-white/75 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/65"
                styles={{ body: { padding: "16px 24px" } }}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
                      Send Portfolio Report
                    </h3>
                    <p className="mt-1 text-[13px] font-normal text-zinc-600 dark:text-zinc-400">
                      Manually send a portfolio report now
                    </p>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    loading={sendingEmail}
                    disabled={sendingEmail}
                    onClick={() => void handleSendEmail()}
                  >
                    Send Portfolio Email Now
                  </Button>

                  {sendError && (
                    <Alert type="error" showIcon message="Error" description={sendError} />
                  )}
                  {sendOk && (
                    <Alert
                      type="success"
                      showIcon
                      message="Success"
                      description="Portfolio report sent successfully."
                    />
                  )}
                </div>
              </Card>

              <div className="rounded-lg border border-sky-200/60 bg-sky-50/90 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/40">
                <p className="text-[13px] font-medium text-sky-900 dark:text-sky-200">
                  Vercel-friendly email setup
                </p>
                <p className="mt-1 text-[13px] font-normal text-sky-800 dark:text-sky-300">
                  This app now uses Resend instead of SMTP. Set only <strong>RESEND_API_KEY</strong> in Vercel Project Settings to enable sending. <strong>RESEND_FROM</strong> is optional.
                </p>
              </div>

              <div className="rounded-lg border border-amber-200/60 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/40">
                <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
                  Automatic Monthly Reports
                </p>
                <p className="mt-1 text-[13px] font-normal text-amber-800 dark:text-amber-300">
                  A portfolio report is automatically sent on the 1st of each month at 9:00 AM.
                </p>
              </div>
            </div>
          ),
        },
        {
          key: "password",
          label: "Password",
          children: (
            <Card
              variant="outlined"
              className="rounded-xl border-teal-200/50 bg-white/75 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/65"
              styles={{ body: { padding: "16px 24px" } }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
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
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
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
                  <label className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
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
  );
}
