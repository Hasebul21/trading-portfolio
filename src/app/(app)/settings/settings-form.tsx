"use client";

import { updatePortfolioReportEmail } from "../settings-actions";
import { sendPortfolioEmailWithUserSettings } from "./settings-actions";
import type { UserSettings } from "../settings-actions";
import { Alert, Button, Card, Input, Space } from "antd";
import { useCallback, useState } from "react";

export function SettingsForm({ initialSettings }: { initialSettings: UserSettings }) {
  const [email, setEmail] = useState(initialSettings.portfolio_report_email);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState(false);

  const handleSaveEmail = useCallback(async () => {
    setSaveError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      const res = await updatePortfolioReportEmail(email);
      if (!res.ok) {
        setSaveError(res.error);
      } else {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save email");
    } finally {
      setSaving(false);
    }
  }, [email]);

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
              Email address where portfolio reports will be sent
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaveError(null);
                  setSaveOk(false);
                }}
                placeholder="email@example.com"
                size="large"
                className="rounded-md"
              />
            </div>
            <Button
              type="primary"
              size="large"
              loading={saving}
              disabled={saving || email === initialSettings.portfolio_report_email}
              onClick={() => void handleSaveEmail()}
              className="whitespace-nowrap"
            >
              Save Email
            </Button>
          </div>

          {saveError && (
            <Alert type="error" showIcon message="Error" description={saveError} className="mt-2" />
          )}
          {saveOk && (
            <Alert
              type="success"
              showIcon
              message="Success"
              description="Email address updated successfully."
              className="mt-2"
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
            <h3 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">Send Portfolio Report</h3>
            <p className="mt-1 text-[13px] font-normal text-zinc-600 dark:text-zinc-400">
              Manually send a portfolio report to {email}
            </p>
          </div>

          <Space>
            <Button
              type="primary"
              size="large"
              loading={sendingEmail}
              disabled={sendingEmail}
              onClick={() => void handleSendEmail()}
            >
              Send Portfolio Email Now
            </Button>
          </Space>

          {sendError && (
            <Alert
              type="error"
              showIcon
              message="Error"
              description={sendError}
              className="mt-2"
            />
          )}
          {sendOk && (
            <Alert
              type="success"
              showIcon
              message="Success"
              description="Portfolio report email sent successfully."
              className="mt-2"
            />
          )}
        </div>
      </Card>

      <div className="rounded-lg border border-amber-200/60 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/40">
        <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
          Monthly Automatic Report
        </p>
        <p className="mt-1 text-[13px] font-normal text-amber-800 dark:text-amber-300">
          A portfolio report is automatically sent on the last day of each month at the configured time.
        </p>
      </div>
    </div>
  );
}
