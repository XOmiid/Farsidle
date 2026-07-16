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

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("factle_today_status");
  if (error || !data || !data.length) {
    console.error("factle checkTodayStatus failed", error);
    return { played: false, won: false, tries: null };
  }
  return data[0];
}

export async function recordAttempt(won, tries) {
  const { error } = await supabase.rpc("factle_record_attempt", { p_won: won, p_tries: tries });
  if (error) console.error("factle recordAttempt failed", error);
}