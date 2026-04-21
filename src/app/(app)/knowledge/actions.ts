"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addKnowledgeNote(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Body text is required." };
  if (title.length > 200) return { ok: false, error: "Title too long (max 200 chars)." };

  const { error } = await supabase.from("knowledge_notes").insert({
    user_id: user.id,
    title,
    body,
  });

  if (error) {
    console.error("addKnowledgeNote", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/knowledge");
  return { ok: true };
}

export async function deleteKnowledgeNote(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing note id." };

  const { error } = await supabase
    .from("knowledge_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteKnowledgeNote", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/knowledge");
  return { ok: true };
}
