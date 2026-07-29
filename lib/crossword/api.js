import { supabase } from "@/lib/supabaseClient";

export async function fetchCrosswordList() {
  const { data, error } = await supabase.rpc("crossword_list");
  if (error) { console.error("crossword_list failed", error); return []; }
  return data || [];
}

export async function fetchCrossword(id) {
  const { data, error } = await supabase.rpc("crossword_get", { p_id: Number(id) });
  if (error) { console.error("crossword_get failed", error); return { data: null, error }; }
  return { data: data?.[0] || null, error: null };
}

export async function purchaseCrossword(id) {
  const { data, error } = await supabase.rpc("crossword_purchase", { p_id: Number(id) });
  if (error) { console.error("crossword_purchase failed", error); return { data: null, error }; }
  return { data: data?.[0] || null, error: null };
}

export async function saveLetter(id, row, col, letter) {
  const { error } = await supabase.rpc("crossword_save_letter", {
    p_id: Number(id), p_row: row, p_col: col, p_letter: letter,
  });
  if (error) console.error("crossword_save_letter failed", error);
}

export async function checkCrossword(id) {
  const { data, error } = await supabase.rpc("crossword_check", { p_id: Number(id) });
  if (error) { console.error("crossword_check failed", error); return { data: null, error }; }
  return { data: data?.[0] || null, error: null };
}