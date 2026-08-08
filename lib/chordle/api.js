import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("chordle_get_today");
  if (error || !data || !data.length) {
    console.error("chordle_get_today failed", error);
    return null;
  }
  return data[0];
  // { date_key, chord_ids: int[9], guitar_seq: int[5], piano_seq: int[5], drums_seq: int[5] }
}

export async function submitRound(round, answer) {
  const { data, error } = await supabase.rpc("chordle_submit_round", {
    p_round: round,
    p_answer: answer,
  });
  if (error || !data || !data.length) {
    console.error("chordle_submit_round failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null };
  // { correct_slots: bool[], round_score: int, game_over: bool, correct_seq: int[] }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("chordle_submit_score");
  if (error) { console.error("chordle_submit_score failed", error); return { data: null, error }; }
  return { data: data || [], error: null };
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("chordle_get_leaderboard");
  if (error) { console.error("chordle_get_leaderboard failed", error); return []; }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("chordle_today_status");
  if (error || !data || !data.length) {
    return { played: false, total_score: null, current_round: 1, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}