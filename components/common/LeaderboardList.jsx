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

// Single podium column — used for 1st, 2nd, 3rd
function PodiumSlot({ entry, rank, coins, renderExtra }) {
  const is1st = rank === 1;
  const is2nd = rank === 2;

  const medal  = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const ringCls = is1st
    ? "border-yellow shadow-[0_0_18px_rgba(250,204,21,0.4)]"
    : is2nd
    ? "border-slate-300"
    : "border-amber-600";
  const avatarSize = is1st ? 60 : 44;
  const nameCls = is1st ? "text-[.95rem] font-bold" : "text-[.78rem] font-semibold";

  return (
    <div className={`flex flex-col items-center gap-1 ${is1st ? "mt-0" : "mt-6"}`}>
      {/* Medal emoji above avatar */}
      <span className={is1st ? "text-[1.6rem] leading-none mb-0.5" : "text-[1.2rem] leading-none mb-0.5"}>
        {medal}
      </span>

      {/* Avatar using the real Avatar component */}
      <div className={`rounded-full border-2 ${ringCls} overflow-hidden flex-shrink-0`}
        style={{ width: avatarSize, height: avatarSize }}>
        <Avatar
          avatarKey={entry.avatar}
          username={entry.name}
          size={avatarSize}
          rank={rank}
        />
      </div>

      {/* Name */}
      <span className={`text-ivory ${nameCls} text-center max-w-[80px] truncate leading-tight mt-0.5`}>
        {entry.name}
      </span>

      {/* Streak */}
      {entry.streak >= 2 && <StreakBadge streak={entry.streak} />}

      {/* Score */}
      {renderExtra && (
        <div className="text-center">{renderExtra(entry)}</div>
      )}

      {/* Coins */}
      {coins !== null && coins > 0 && (
        <span className="text-[.68rem] text-yellow">
          🪙 {toPersianDigits(coins)}
        </span>
      )}
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

  const top3   = entries.slice(0, 3);
  const rest   = entries.slice(3);
  const first  = top3[0];
  const second = top3[1];
  const third  = top3[2];

  const coins1 = first?.user_id  ? coinsMap[first.user_id]  : null;
  const coins2 = second?.user_id ? coinsMap[second.user_id] : null;
  const coins3 = third?.user_id  ? coinsMap[third.user_id]  : null;

  return (
    <div className="w-full">

      {/* Olympic podium — 2nd | 1st | 3rd */}
      <div className="flex items-end justify-center gap-4 mb-4 pb-3 border-b border-border">

        {/* 2nd place — left */}
        {second ? (
          <PodiumSlot entry={second} rank={2} coins={coins2} renderExtra={renderExtra} />
        ) : (
          <div className="w-[80px] mt-6" />
        )}

        {/* 1st place — center, elevated */}
        <PodiumSlot entry={first} rank={1} coins={coins1} renderExtra={renderExtra} />

        {/* 3rd place — right */}
        {third ? (
          <PodiumSlot entry={third} rank={3} coins={coins3} renderExtra={renderExtra} />
        ) : (
          <div className="w-[80px] mt-6" />
        )}
      </div>

      {/* Ranks 4+ — scrollable list */}
      {rest.length > 0 && (
        <div className="overflow-y-auto max-h-[240px] flex flex-col gap-1.5">
          {rest.map((e, i) => {
            const rank = i + 4;
            const isHighlight = i + 3 === highlightIndex;
            const coins = e.user_id ? coinsMap[e.user_id] : null;
            return (
              <div
                key={e.name + i}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-right flex-shrink-0 ${
                  isHighlight ? "border-green bg-green/10" : "border-border bg-white/[.03]"
                }`}
              >
                <span className="text-[.78rem] font-bold min-w-[20px] text-center text-ivory-dim flex-shrink-0">
                  {toPersianDigits(rank)}
                </span>
                <Avatar avatarKey={e.avatar} username={e.name} size={28} rank={rank} />
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-ivory text-[.82rem] truncate">{e.name}</span>
                  {e.streak >= 2 && <StreakBadge streak={e.streak} />}
                </div>
                {coins !== null && coins > 0 && (
                  <span className="text-[.7rem] text-yellow flex-shrink-0">
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
