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

// Server-side, account-tied record of whether the current logged-in user
// already finished today's puzzle — survives cleared/isolated local
// storage (e.g. re-adding an iOS home-screen web app), unlike the
// localStorage-only check. Anonymous callers always get played: false.
export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("wordle_today_status");
  if (error || !data || !data.length) {
    console.error("checkTodayStatus failed", error);
    return { played: false, won: false, tries: null, streak: 0 };
  }
  return data[0];
}

// Records a completed attempt (win or lose) server-side. No-op for
// anonymous players — this is account-tied tracking only. Returns
// the player's updated streak for that game.
export async function recordAttempt(won, tries) {
  const { data, error } = await supabase.rpc("wordle_record_attempt", { p_won: won, p_tries: tries });
  if (error) {
    console.error("recordAttempt failed", error);
    return 0;
  }
  return data?.[0]?.streak ?? 0;
}