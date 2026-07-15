import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("get_today_puzzle");
  if (error || !data || !data.length) {
    console.error("fetchTodayPuzzle failed", error);
    return null;
  }
  return data[0]; // { date_key, word, length }
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("get_today_leaderboard");
  if (error) {
    console.error("fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function submitScore(tries) {
  const { data, error } = await supabase.rpc("submit_score", { p_tries: tries });
  if (error) {
    console.error("submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}
