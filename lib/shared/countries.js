import { supabase } from "@/lib/supabaseClient";

export async function fetchCountryList() {
  const { data, error } = await supabase.from("countries").select("name_fa").order("name_fa");
  if (error) {
    console.error("fetchCountryList failed", error);
    return [];
  }
  return (data || []).map((row) => row.name_fa);
}
