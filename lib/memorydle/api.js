import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("memorydle_get_today");
  if (error || !data || !data.length) {
    console.error("memorydle fetchTodayPuzzle failed", error);
    return null;
  }
  return data[0]; // { date_key, l1_grid, l2_grid }
}

export async function submitAnswers(l1Picks, l2Picks) {
  const { data, error } = await supabase.rpc("memorydle_submit", {
    p_l1_picks: l1Picks,
    p_l2_picks: l2Picks,
  });
  if (error || !data || !data.length) {
    console.error("memorydle submitAnswers failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null };
  // { l1_correct, l2_correct, total_score, l1_targets, l2_targets }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("memorydle_submit_score");
  if (error) {
    console.error("memorydle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("memorydle_get_leaderboard");
  if (error) {
    console.error("memorydle fetchLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("memorydle_today_status");
  if (error || !data || !data.length) {
    return { played: false, total_score: null, l1_correct: null, l2_correct: null, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}