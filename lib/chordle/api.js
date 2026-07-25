import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayInfo() {
  const { data, error } = await supabase.rpc("chordle_get_today");
  if (error || !data || !data.length) {
    console.error("chordle fetchTodayInfo failed", error);
    return null;
  }
  return data[0]; // { date_key, round1_len, round2_len, round3_len }
}

export async function fetchRoundSequence(round) {
  const { data, error } = await supabase.rpc("chordle_get_round", { p_round: round });
  if (error || !data || !data.length) {
    console.error("chordle fetchRoundSequence failed", error);
    return null;
  }
  return data[0].chords; // int[]
}

export async function submitRound(round, answer) {
  const { data, error } = await supabase.rpc("chordle_submit_round", {
    p_round: round,
    p_answer: answer,
  });
  if (error || !data || !data.length) {
    console.error("chordle submitRound failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null };
  // { correct: bool, game_over: bool, correct_sequence: int[] }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("chordle_submit_score");
  if (error) {
    console.error("chordle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("chordle_get_leaderboard");
  if (error) {
    console.error("chordle fetchLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("chordle_today_status");
  if (error || !data || !data.length) {
    console.error("chordle checkTodayStatus failed", error);
    return { played: false, rounds_completed: null, current_round: 1, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}