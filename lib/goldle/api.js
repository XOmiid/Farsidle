import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayQuestions() {
  const { data, error } = await supabase.rpc("goldle_get_today_questions");
  if (error || !data || !data.length) {
    console.error("goldle fetchTodayQuestions failed", error);
    return null;
  }
  return data; // [{ date_key, q_index, question_fa, choice_a..d }, ...] in order
}

export async function fetchTodayReveal() {
  const { data, error } = await supabase.rpc("goldle_get_today_reveal");
  if (error) {
    console.error("goldle fetchTodayReveal failed", error);
    return null;
  }
  return data || []; // [{ q_index, question_fa, choice_a..d, correct_choice }, ...]
}

export async function submitBet(qIndex, betA, betB, betC, betD) {
  const { data, error } = await supabase.rpc("goldle_submit_bet", {
    p_q_index: qIndex,
    p_bet_a: betA,
    p_bet_b: betB,
    p_bet_c: betC,
    p_bet_d: betD,
  });
  if (error || !data || !data.length) {
    console.error("goldle submitBet failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null }; // { correct_choice, gold_after, game_over }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("goldle_submit_score");
  if (error) {
    console.error("goldle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("goldle_get_today_leaderboard");
  if (error) {
    console.error("goldle fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("goldle_today_status");
  if (error || !data || !data.length) {
    console.error("goldle checkTodayStatus failed", error);
    return {
      played: false,
      final_gold: null,
      questions_reached: null,
      current_q_index: 1,
      current_gold: 100,
      leaderboard_submitted: false,
      streak: 0,
    };
  }
  return data[0];
}