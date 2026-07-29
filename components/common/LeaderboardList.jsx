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

function FirstPlaceSpotlight({ entry, coins }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 mb-2">
      {/* Crown */}
      <span className="text-[2rem] leading-none">👑</span>

      {/* Avatar — bigger */}
      <div className="w-16 h-16 rounded-full bg-yellow/20 border-2 border-yellow flex items-center justify-center text-yellow text-2xl font-extrabold shadow-[0_0_20px_rgba(250,204,21,0.35)]">
        {(entry.name || "؟")[0]}
      </div>

      {/* Name */}
      <span className="text-ivory font-bold text-[1.05rem]">{entry.name}</span>

      {/* Streak */}
      {entry.streak >= 2 && (
        <StreakBadge streak={entry.streak} className="text-sm" />
      )}

      {/* Coins + score in one row */}
      <div className="flex items-center gap-3">
        {coins !== null && coins > 0 && (
          <span className="text-yellow text-[.82rem] font-semibold">
            🪙 {toPersianDigits(coins)}
          </span>
        )}
      </div>
    </div>
  );
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

  const first = entries[0];
  const rest = entries.slice(1);
  const firstCoins = first.user_id ? coinsMap[first.user_id] : null;

  return (
    <div className="w-full">
      {/* First place spotlight */}
      <FirstPlaceSpotlight entry={first} coins={firstCoins} />
      {renderExtra && (
        <div className="flex justify-center mb-3 -mt-2">
          {renderExtra(first)}
        </div>
      )}

      {/* Divider */}
      {rest.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-ivory-dim text-[.7rem]">بقیه</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Ranks 2+ — scrollable, max 5 rows visible */}
      {rest.length > 0 && (
        <div className="overflow-y-auto max-h-[280px] flex flex-col gap-1.5 pl-0.5">
          {rest.map((e, i) => {
            const rank = i + 2;
            const isHighlight = i + 1 === highlightIndex;
            const coins = e.user_id ? coinsMap[e.user_id] : null;
            return (
              <div
                key={e.name + i}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-right flex-shrink-0 ${
                  isHighlight ? "border-green bg-green/10" : "border-border bg-white/[.03]"
                }`}
              >
                <span className={`text-[.78rem] font-bold min-w-[20px] text-center flex-shrink-0 ${
                  rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-ivory-dim"
                }`}>
                  {toPersianDigits(rank)}
                </span>
                <Avatar avatarKey={e.avatar} username={e.name} size={28} rank={rank} />
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-ivory text-[.82rem] truncate">{e.name}</span>
                  {e.streak >= 2 && <StreakBadge streak={e.streak} />}
                </div>
                {coins !== null && coins > 0 && (
                  <span className="text-[.7rem] text-yellow flex items-center gap-0.5 flex-shrink-0">
                    🪙{toPersianDigits(coins)}
                  </span>
                )}
                {renderExtra && renderExtra(e)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
