import { supabase } from "@/lib/supabaseClient";

export async function joinTeamdle() {
  const { data, error } = await supabase.rpc("teamdle_join");
  if (error) { console.error("teamdle_join failed", error); return { data: null, error }; }
  return { data: data?.[0] || null, error: null };
  // { team, slot, countries: [{id, name_fa, capital, decoy}], already_played }
}

export async function submitAnswers(answers) {
  const { data, error } = await supabase.rpc("teamdle_submit", {
    p_answers: answers,
  });
  if (error) { console.error("teamdle_submit failed", error); return { data: null, error }; }
  return { data: data?.[0] || null, error: null };
  // { score, team, coins_earned }
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("teamdle_leaderboard");
  if (error) { console.error("teamdle_leaderboard failed", error); return []; }
  return data || [];
}

export async function fetchYesterdayResult() {
  const { data, error } = await supabase.rpc("teamdle_yesterday_result");
  if (error) { console.error("teamdle_yesterday_result failed", error); return null; }
  return data?.[0] || null;
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("teamdle_today_status");
  if (error) { console.error("teamdle_today_status failed", error); return null; }
  return data?.[0] || null;
}