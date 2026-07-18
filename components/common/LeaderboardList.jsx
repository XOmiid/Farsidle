"use client";

import { toPersianDigits } from "@/lib/wordle/logic";
import Avatar from "@/components/common/Avatar";
import StreakBadge from "@/components/common/StreakBadge";

export default function LeaderboardList({ entries, highlightIndex, loading, emptyNoun, renderExtra }) {
  if (loading) {
    return <p className="text-ivory-dim text-[.82rem] mt-1.5">در حال بارگذاری...</p>;
  }
  if (!entries.length) {
    return (
      <p className="text-ivory-dim text-[.82rem] mt-1.5">
        هنوز کسی این {emptyNoun} رو درست حدس نزده، اولین نفر تو باش!
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pt-2">
      {entries.slice(0, 30).map((e, i) => {
        const isMe = i === highlightIndex;
        const rank = i + 1;
        return (
          <div
            key={`${e.name}-${e.solved_at}-${i}`}
            className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${
              isMe
                ? "border-green bg-green/[.14]"
                : rank === 1
                ? "border-yellow bg-yellow/10"
                : "border-border bg-white/[.03]"
            }`}
          >
            <span
              className={`font-extrabold min-w-[20px] text-center text-[.8rem] ${
                isMe ? "text-green" : rank === 1 ? "text-yellow" : "text-green-dim"
              }`}
            >
              {toPersianDigits(rank)}
            </span>
            <Avatar avatarKey={e.avatar} username={e.name} size={38} rank={rank} />
            <span className="flex-1 text-right text-ivory text-[.9rem] overflow-hidden text-ellipsis whitespace-nowrap">
              {e.name}
            </span>
            <StreakBadge streak={e.streak} />
            {renderExtra && renderExtra(e)}
          </div>
        );
      })}
    </div>
  );
}
