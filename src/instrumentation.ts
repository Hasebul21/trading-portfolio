export async function register() {
  // Node-runtime only: register the missing dsebd.org TLS intermediate so that
  // server-side market-data fetches don't fail with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDseTlsTrust } = await import("@/lib/market/dse-tls");
    ensureDseTlsTrust();
  }
}
