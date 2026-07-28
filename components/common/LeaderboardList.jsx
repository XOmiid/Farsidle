"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toPersianDigits } from "@/lib/shared/persian";
import Avatar from "@/components/common/Avatar";
import StreakBadge from "@/components/common/StreakBadge";

async function fetchGameCoins(userId, game) {
  if (!userId) return null;
  const { data } = await supabase.rpc("get_game_coins_today", {
    p_user_id: userId,
    p_game: game,
  });
  return data ?? null;
}

export default function LeaderboardList({
  entries = [],
  loading = false,
  highlightIndex = -1,
  emptyNoun = "بازیکن",
  renderExtra,
  game,
}) {
  const [coinsMap, setCoinsMap] = useState({});

  useEffect(() => {
    if (!game || !entries.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        entries
          .filter((e) => e.user_id)
          .map(async (e) => {
            const coins = await fetchGameCoins(e.user_id, game);
            return [e.user_id, coins];
          })
      );
      if (!cancelled) setCoinsMap(Object.fromEntries(results));
    })();
    return () => { cancelled = true; };
  }, [entries, game]);

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <p className="text-ivory-dim text-[.82rem] text-center py-4">
        هنوز کسی {emptyNoun} ثبت نکرده
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col gap-1.5">
      {entries.map((e, i) => {
        const rank = i + 1;
        const isHighlight = i === highlightIndex;
        const coins = e.user_id ? coinsMap[e.user_id] : null;
        return (
          <div key={e.name + i}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-right ${
              isHighlight ? "border-green bg-green/10" : "border-border bg-white/[.03]"
            }`}>
            <span className={`text-[.78rem] font-bold min-w-[20px] text-center flex-shrink-0 ${
              rank === 1 ? "text-yellow" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-ivory-dim"
            }`}>{toPersianDigits(rank)}</span>
            <Avatar avatarKey={e.avatar} username={e.name} size={32} rank={rank} />
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className="text-ivory text-[.85rem] truncate">{e.name}</span>
              {e.streak >= 2 && <StreakBadge streak={e.streak} />}
            </div>
            {coins !== null && coins > 0 && (
              <span className="text-[.72rem] text-yellow flex items-center gap-0.5 flex-shrink-0">
                🪙{toPersianDigits(coins)}
              </span>
            )}
            {renderExtra && renderExtra(e)}
          </div>
        );
      })}
    </div>
  );
}
