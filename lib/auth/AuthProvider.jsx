"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext({
  loading: true,
  user: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

async function loadProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar, birth_date, country, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("loadProfile failed", error);
    return null;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data?.user || null;
    setUser(u);
    setProfile(u ? await loadProfile(u.id) : null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user || null;
      if (cancelled) return;
      setUser(u);
      setProfile(u ? await loadProfile(u.id) : null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null;
      setUser(u);
      setProfile(u ? await loadProfile(u.id) : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
