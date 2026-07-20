import { supabase } from "@/lib/supabaseClient";

export async function fetchTodayCurrencies() {
  const { data, error } = await supabase.rpc("moneydle_get_today_currencies");
  if (error || !data || !data.length) {
    console.error("moneydle fetchTodayCurrencies failed", error);
    return null;
  }
  return data; // [{ date_key, currency_id, code, name_fa }, ...] shuffled
}

export async function submitRanking(orderedCurrencyIds) {
  const { data, error } = await supabase.rpc("moneydle_submit_ranking", {
    p_currency_ids: orderedCurrencyIds,
  });
  if (error || !data || !data.length) {
    console.error("moneydle submitRanking failed", error);
    return { data: null, error };
  }
  return { data: data[0], error: null }; // { score, correct_order: [{code,name_fa,usd_value}, ...] }
}

export async function submitScore() {
  const { data, error } = await supabase.rpc("moneydle_submit_score");
  if (error) {
    console.error("moneydle submitScore failed", error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

export async function fetchTodayLeaderboard() {
  const { data, error } = await supabase.rpc("moneydle_get_today_leaderboard");
  if (error) {
    console.error("moneydle fetchTodayLeaderboard failed", error);
    return [];
  }
  return data || [];
}

export async function checkTodayStatus() {
  const { data, error } = await supabase.rpc("moneydle_today_status");
  if (error || !data || !data.length) {
    console.error("moneydle checkTodayStatus failed", error);
    return { played: false, score: null, leaderboard_submitted: false, streak: 0 };
  }
  return data[0];
}
