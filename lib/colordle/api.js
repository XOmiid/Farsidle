import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("colordle_get_today_puzzle");
  if (error || !data || !data.length) {
    console.error("colordle fetchTodayPuzzle failed", error);
    return null;
  }
  return data[0]; // { date_key }
}

// Reveals the real color. For logged-in users this only ever "starts
// the clock" once per day server-side — calling it again (e.g. after
// a reload during the 10s window) returns the SAME revealed_at, not
// a fresh one, so the client can compute remaining time correctly.
export async function reveal() {
  const { data, error } = await supabase.rpc("colordle_reveal");
  if (error || !data || !data.length) {
    console.error("colordle reveal failed", error);
    return null;
  }
  return data[0]; // { target_r, target_g, target_b, revealed_at }
}

export async function submitGuess(r, g, b) {
  const { data, error } = await supabase.rpc("colordle_submit_guess", { p_r: r, p_g: g, p_b: b });
  if (error || !data || !data.length) {
    console.error("colordle submitGuess failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null }; // { score, target_r, target_g, target_b, streak }
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("colordle_get_today_leaderboard");
  if (error) {
    console.error("colordle fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("colordle_submit_score");
  if (error) {
    console.error("colordle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("colordle_today_status");
  if (error || !data || !data.length) {
    console.error("colordle checkTodayStatus failed", error);
    return {
      played: false,
      revealed: false,
      revealed_at: null,
      score: null,
      target_r: null,
      target_g: null,
      target_b: null,
      leaderboard_submitted: false,
      streak: 0,
    };
  }
  return data[0];
}