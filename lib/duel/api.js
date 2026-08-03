import { supabase } from "@/lib/supabaseClient";

// ── Internal helpers ───────────────────────────────────────────────────────

async function getRawPuzzle() {
  const { data, error } = await supabase.rpc("duel_get_today");
  if (error || !data || !data.length) {
    console.error("duel_get_today failed", error);
    return null;
  }
  return data[0]; // { date_key, pairs: [{q, a_id, a_prompt, a_value, a_unit, b_prompt, b_value, b_unit}] }
}

// Map DB shape to what DuelGame.jsx expects
function mapPairs(row) {
  if (!row || !row.pairs) return null;
  return row.pairs.map((p) => ({
    q:        p.q,
    q_index:  p.q,           // component uses q.q_index
    date_key: row.date_key,  // component reads pairs[0].date_key
    prompt_a: p.a_prompt,
    value_a:  p.a_value,
    unit_a:   p.a_unit,
    prompt_b: p.b_prompt,
    value_b:  p.b_value,
    unit_b:   p.b_unit,
  }));
}

// ── Exports used by DuelGame.jsx ───────────────────────────────────────────

// Returns an array of pair objects — component does pairs[0].date_key
export async function fetchTodayPairs() {
  const row = await getRawPuzzle();
  return mapPairs(row);
}

// Component calls submitAnswer(q.q_index, side)
export async function submitAnswer(question, picked) {
  const { data, error } = await supabase.rpc("duel_submit_answer", {
    p_question: question,
    p_picked: picked,
  });
  if (error || !data || !data.length) {
    console.error("duel_submit_answer failed", error);
    return null; // component checks `if (!result)`
  }
  const r = data[0];
  return {
    correct: r.correct,
    value_a: r.a_value,
    value_b: r.b_value,
    score_so_far: r.score_so_far,
  };
}

// Component destructures { data: finalScore, streak, error }
export async function finalize() {
  const { data, error } = await supabase.rpc("duel_submit_score");
  if (error) {
    console.error("finalize failed", error);
    return { data: null, streak: 0, error };
  }
  // Get updated streak
  const status = await checkTodayStatus();
  return { data: status.score ?? null, streak: status.streak ?? 0, error: null };
}

// Component calls fetchTodayReveal() and maps over the result array
export async function fetchTodayReveal() {
  const row = await getRawPuzzle();
  return mapPairs(row); // returns array, component does revealPairs.map(...)
}

// Component calls fetchTodayLeaderboard()
export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("duel_get_leaderboard");
  if (error) { console.error("duel_get_leaderboard failed", error); return []; }
  return data || [];
}

// Component calls submitScore() and destructures { data: entries, error }
export async function submitScore() {
  const { data, error } = await supabase.rpc("duel_submit_score");
  if (error) { console.error("duel_submit_score failed", error); return { data: null, error }; }
  return { data: data || [], error: null };
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("duel_today_status");
  if (error || !data || !data.length) {
    return { played: false, score: null, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}

// Aliases
export { fetchTodayLeaderboard as fetchLeaderboard };
export { fetchTodayPairs as fetchTodayPuzzle };