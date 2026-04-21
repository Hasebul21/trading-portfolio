import { AppPageHeader } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import {
  KnowledgeModule,
  type KnowledgeNoteDTO,
} from "@/components/knowledge/knowledge-module";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let notes: KnowledgeNoteDTO[] = [];
  if (user) {
    const { data } = await supabase
      .from("knowledge_notes")
      .select("id, created_at, title, body")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) notes = data as KnowledgeNoteDTO[];
  }

  return (
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto max-w-5xl text-left">
      <AppPageHeader title="Knowledge" />
      <KnowledgeModule notes={notes} />
    </AppPageStack>
  );
}
