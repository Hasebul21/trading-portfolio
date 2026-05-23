import { computeDiscoveryPicks } from "@/lib/market/discovery";
import type { DseLspQuote } from "@/lib/market/dse-lsp-quotes";
import { DiscoverySection } from "./discovery-section";

/**
 * Async server component for the Discovery slate. Designed to be wrapped in a
 * `<Suspense>` boundary so the Trade Desk page can stream the main payload
 * first and let the slower wider-DSE scan fill in below.
 */
export async function DiscoveryAsync({
  bySymbol,
  excludeSymbols,
  topSectors,
}: {
  bySymbol: Map<string, DseLspQuote>;
  excludeSymbols: string[];
  topSectors: string[];
}) {
  const { picks } = await computeDiscoveryPicks({ bySymbol, excludeSymbols });
  return <DiscoverySection items={picks} topSectors={topSectors} />;
}
