"use client";

import { useCallback, useState } from "react";
import { Icons, SCard, SCardBody, SCardHead } from "./settings-ui";

/* ── Static reference data ──────────────────────────────────────────────────
 * Bank accounts for subscribing to each mutual fund, plus the Bini app used to
 * invest in them. This is fixed reference info (not user-specific), so it lives
 * in the component rather than the database.
 */

type Tone = "acc" | "gain" | "warn" | "loss";

type FundAccount = {
  fund: string;
  tone: Tone;
  bankName: string;
  branch: string;
  routingNumber: string;
  accountName: string;
  accountNumber: string;
};

const FUNDS: FundAccount[] = [
  {
    fund: "EDGE AMC Growth Fund",
    tone: "acc",
    bankName: "Midland Bank PLC",
    branch: "Dhanmondi",
    routingNumber: "285261185",
    accountName: "EDGE AMC Growth Fund",
    accountNumber: "00081060000078",
  },
  {
    fund: "VIPB Growth Fund",
    tone: "gain",
    bankName: "BRAC BANK PLC",
    branch: "Gulshan North",
    routingNumber: "060261876",
    accountName: "VIPB Growth Fund",
    accountNumber: "1526203891552001",
  },
  {
    fund: "Ekush Growth Fund",
    tone: "warn",
    bankName: "Midland Bank Ltd",
    branch: "Motijheel",
    routingNumber: "285271933",
    accountName: "Ekush Growth Fund",
    accountNumber: "0001-1060000119",
  },
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }, [value]);

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copied" : ""}`}
      onClick={() => void copy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? Icons.check(15) : Icons.copy(15)}
    </button>
  );
}

function InfoRow({
  label,
  value,
  copy,
  mono,
}: {
  label: string;
  value: string;
  copy?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="info-row">
      <span className="ik">{label}</span>
      <span className="iv">
        {copy ? <CopyButton value={value} label={label} /> : null}
        <span className={mono ? "mono" : undefined}>{value}</span>
      </span>
    </div>
  );
}

export function MutualFunds() {
  return (
    <>
      {FUNDS.map((f) => (
        <SCard key={f.fund}>
          <SCardHead tone={f.tone} icon={Icons.fund()} title={f.fund} desc={`Account information · ${f.bankName}`} />
          <SCardBody>
            <div className="info-list">
              <InfoRow label="Bank Name" value={f.bankName} />
              <InfoRow label="Branch" value={f.branch} />
              <InfoRow label="Routing Number" value={f.routingNumber} copy mono />
              <InfoRow label="Account Name" value={f.accountName} copy />
              <InfoRow label="Account Number" value={f.accountNumber} copy mono />
            </div>
          </SCardBody>
        </SCard>
      ))}

      <SCard>
        <SCardHead
          tone="acc"
          icon={Icons.app()}
          title="Bini app"
          desc="The investment app used to subscribe to and manage the mutual funds above."
        />
        <SCardBody>
          <div className="notice">
            <b>How it works.</b> Subscribe to a fund by transferring to its bank account above, then track and manage your
            units in the Bini app. Bini is available on the App Store and Google Play.
          </div>
        </SCardBody>
      </SCard>
    </>
  );
}
