import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayPuzzle() {
  const { data, error } = await supabase.rpc("duel_get_today");
  if (error || !data || !data.length) {
    console.error("duel_get_today failed", error);
    return null;
  }
  // pairs is a jsonb array: [{q, a_id, a_prompt, a_value, a_unit, b_id, b_prompt, b_value, b_unit}]
  return data[0];
}

export async function submitAnswer(question, picked) {
  const { data, error } = await supabase.rpc("duel_submit_answer", {
    p_question: question,
    p_picked: picked, // 'a' or 'b'
  });
  if (error || !data || !data.length) {
    console.error("duel_submit_answer failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null };
  // { correct, a_value, b_value, score_so_far }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("duel_submit_score");
  if (error) {
    console.error("duel_submit_score failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("duel_get_leaderboard");
  if (error) {
    console.error("duel_get_leaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("duel_today_status");
  if (error || !data || !data.length) {
    return { played: false, score: null, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}