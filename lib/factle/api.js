import { supabase } from "@/lib/supabaseClient";

export { fetchCountryList } from "@/lib/shared/countries";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("factle_get_today_puzzle");
  if (error || !data || !data.length) {
    console.error("factle fetchTodayPuzzle failed", error);
    return null;
  }
  return data[0]; // { date_key, country_name, facts: string[6] }
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("factle_get_today_leaderboard");
  if (error) {
    console.error("factle fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function submitScore(tries) {
  const { data, error } = await supabase.rpc("factle_submit_score", { p_tries: tries });
  if (error) {
    console.error("factle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}