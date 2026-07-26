import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayQuestions() {
  const { data, error } = await supabase.rpc("pricedle_get_today");
  if (error || !data || !data.length) {
    console.error("pricedle fetchTodayQuestions failed", error);
    return null;
  }
  return data; // [{ date_key, q_index, question_fa, year, category }, ...]
}

export async function submitGuess(qIndex, guessToman) {
  const { data, error } = await supabase.rpc("pricedle_submit_guess", {
    p_q_index: qIndex,
    p_guess: guessToman,
  });
  if (error || !data || !data.length) {
    console.error("pricedle submitGuess failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null };
  // { score, correct_answer, total_so_far, game_over }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("pricedle_submit_score");
  if (error) {
    console.error("pricedle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("pricedle_get_leaderboard");
  if (error) {
    console.error("pricedle fetchLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("pricedle_today_status");
  if (error || !data || !data.length) {
    return { played: false, total_score: null, current_q_index: 1, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}