/**
 * Bangladesh / CDBL-style charges (BDT) for trade recording.
 * Rates match common BO charge sheets; adjust constants if your broker differs.
 */

export const BD_CHARGES = {
  accountOpeningBdt: 950,
  annualBoMaintenanceBdt: 450,
  /** Transfer-In / Transmission-In */
  transferInRate: 0.000125, // 0.0125%
  /** Transfer-Out / Transmission-Out */
  transferOutRate: 0.00025, // 0.025%
  /** Demat: % of MV + flat per scrip */
  dematRate: 0.00015, // 0.015%
  dematPerScripBdt: 1000,
  /** Remat: per security + per scrip */
  rematPerSecurityBdt: 0.1,
  rematPerScripBdt: 1000,
  pledgeRate: 0.0025, // 0.25%
  unpledgeRate: 0.00125, // 0.125%
  chequeDishonorBdt: 1000,
  wealthCertificateEachBdt: 200,
} as const;

export type TradeFeeFlags = {
  applyTransfer: boolean;
  applyDemat: boolean;
  applyRemat: boolean;
  applyPledge: boolean;
  applyUnpledge: boolean;
  extraFeesBdt: number;
};

export function marketValueBdt(quantity: number, pricePerShare: number): number {
  return quantity * pricePerShare;
}

/** Round to 2 decimal places (BDT). */
export function roundBdt(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Transaction-level fees for one buy or sell line.
 * - Transfer-In applies to buys; Transfer-Out to sells (when applyTransfer).
 * - Demat / Remat / Pledge / Unpledge are optional per trade.
 * - extraFeesBdt covers flat items (e.g. cheque dishonor, wealth certs) you enter manually.
 */
export function computeTransactionFeesBdt(
  side: "buy" | "sell",
  quantity: number,
  pricePerShare: number,
  flags: TradeFeeFlags,
): number {
  const mv = marketValueBdt(quantity, pricePerShare);
  let total = 0;

  if (flags.applyTransfer) {
    if (side === "buy") {
      total += mv * BD_CHARGES.transferInRate;
    } else {
      total += mv * BD_CHARGES.transferOutRate;
    }
  }

  if (flags.applyDemat) {
    total += mv * BD_CHARGES.dematRate + BD_CHARGES.dematPerScripBdt;
  }

  if (flags.applyRemat) {
    total += quantity * BD_CHARGES.rematPerSecurityBdt + BD_CHARGES.rematPerScripBdt;
  }

  if (flags.applyPledge) {
    total += mv * BD_CHARGES.pledgeRate;
  }

  if (flags.applyUnpledge) {
    total += mv * BD_CHARGES.unpledgeRate;
  }

  const extra = Number.isFinite(flags.extraFeesBdt) ? flags.extraFeesBdt : 0;
  if (extra > 0) {
    total += extra;
  }

  return roundBdt(total);
}

export function parseFeeFlagsFromFormData(formData: FormData): TradeFeeFlags {
  return {
    applyTransfer: formData.get("apply_transfer") === "on",
    applyDemat: formData.get("apply_demat") === "on",
    applyRemat: formData.get("apply_remat") === "on",
    applyPledge: formData.get("apply_pledge") === "on",
    applyUnpledge: formData.get("apply_unpledge") === "on",
    extraFeesBdt: Math.max(
      0,
      Number(String(formData.get("extra_fees_bdt") ?? "").trim()) || 0,
    ),
  };
}
