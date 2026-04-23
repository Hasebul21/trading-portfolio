import { MonthlyPlanPage } from "@/components/planning/monthly-plan-page";

type PageProps = {
    searchParams: Promise<{ ym?: string }>;
};

export default async function DraftMipPage({ searchParams }: PageProps) {
    return <MonthlyPlanPage searchParams={searchParams} sectionKey="draftMip" />;
}