import { supabaseAdmin } from "./supabase";

/** Deletes generations plus everything that points at them (votes, remix links). */
export async function deleteGenerations(ids: string[]) {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await supabaseAdmin.from("votes").delete().in("generation_id", chunk);
    await supabaseAdmin.from("generations").update({ remix_of: null }).in("remix_of", chunk);
    const { error } = await supabaseAdmin.from("generations").delete().in("id", chunk);
    if (error) throw new Error(error.message);
  }
}
