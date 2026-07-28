"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function CoinDisplay() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [claimedToday, setClaimedToday] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_coin_balance");
    if (data && data.length) {
      setBalance(Number(data[0].balance));
      setClaimedToday(!!data[0].claimed_today);
    }
  }, [user]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleClaim = async () => {
    if (claiming || claimedToday || !user) return;
    setClaiming(true);
    await supabase.rpc("claim_daily_coins");
    await fetchBalance();
    setClaiming(false);
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Coin balance */}
      <button
        onClick={!claimedToday ? handleClaim : undefined}
        title={claimedToday ? "سکه‌های امروز گرفته شد" : "کلیک کن تا سکه‌ی روزانه بگیری"}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[.8rem] font-bold transition-colors ${
          claimedToday
            ? "border-green-dim bg-green/10 text-green cursor-default"
            : "border-yellow bg-yellow/10 text-yellow cursor-pointer hover:bg-yellow/20"
        }`}
      >
        <span>🪙</span>
        <span>{balance !== null ? toPersianDigits(balance) : "..."}</span>
        {!claimedToday && (
          <span className="text-[.65rem] opacity-80">+۲۵</span>
        )}
      </button>

      {/* Store — greyed out, coming soon */}
      <button
        disabled
        className="flex items-center gap-1 text-[.78rem] text-border border border-border rounded-full px-2.5 py-1 cursor-not-allowed opacity-50"
        title="به‌زودی..."
      >
        <span>🏪</span>
        <span>فروشگاه</span>
      </button>
    </div>
  );
}
