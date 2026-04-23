import { MonthlyPlanPage } from "@/components/planning/monthly-plan-page";

type PageProps = {
  searchParams: Promise<{ ym?: string }>;
};

export default async function MipPage({ searchParams }: PageProps) {
  return <MonthlyPlanPage searchParams={searchParams} sectionKey="mip" />;
}
