import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPairs() {
  const { data, error } = await supabase.rpc("duel_get_today_pairs");
  if (error || !data || !data.length) {
    console.error("duel fetchTodayPairs failed", error);
    return null;
  }
  return data; // [{ date_key, q_index, prompt_a, unit_a, prompt_b, unit_b }, ...]
}

export async function submitAnswer(qIndex, side) {
  const { data, error } = await supabase.rpc("duel_submit_answer", {
    p_q_index: qIndex,
    p_side: side,
  });
  if (error || !data || !data.length) {
    console.error("duel submitAnswer failed", error);
    return null;
  }
  return data[0]; // { correct, value_a, value_b }
}

export async function finalize() {
  const { data, error } = await supabase.rpc("duel_finalize");
  if (error || !data || !data.length) {
    console.error("duel finalize failed", error);
    return { data: null, error };
  }
  return { data: data[0].score, error: null };
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("duel_submit_score");
  if (error) {
    console.error("duel submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("duel_get_today_leaderboard");
  if (error) {
    console.error("duel fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("duel_today_status");
  if (error || !data || !data.length) {
    console.error("duel checkTodayStatus failed", error);
    return { played: false, score: null, leaderboard_submitted: false };
  }
  return data[0];
}