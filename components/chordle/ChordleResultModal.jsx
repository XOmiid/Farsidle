"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { toPersianDigits } from "@/lib/shared/persian";
import LeaderboardList from "@/components/common/LeaderboardList";
import StreakBadge from "@/components/common/StreakBadge";

export default function ChordleResultModal({
  open, roundsCompleted, streak, leaderboard, leaderboardLoading,
  alreadySubmitted, submitError, onClose, onSubmitScore,
}) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmitScore();
    setSubmitting(false);
  };

  const perfect = roundsCompleted === 3;
  const emoji = perfect ? "🎹" : roundsCompleted >= 2 ? "👏" : roundsCompleted === 1 ? "💪" : "😅";

  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto">
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[420px] w-full text-center">
        <button onClick={onClose} aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer">✕</button>

        <div className="text-[2.5rem] mb-1">{emoji}</div>
        <h2 className="font-display text-[1.6rem] m-0 mb-1">
          {perfect ? "عالی! همه رو درست گرفتی" : `دور ${toPersianDigits(roundsCompleted ?? 0)} از ۳`}
        </h2>
        <div className="text-[3rem] font-extrabold text-green leading-none my-2">
          {toPersianDigits(roundsCompleted ?? 0)}<span className="text-lg text-ivory-dim">/۳</span>
        </div>

        {streak >= 2 && (
          <p className="mb-2">
            <StreakBadge streak={streak} className="text-base" />
            <span className="text-ivory-dim text-[.8rem] mr-1">روز پشت‌سرهم!</span>
          </p>
        )}

        <div className="my-3.5 text-right">
          {!user && (
            <div className="border border-green-dim bg-green/[.06] rounded-xl p-3.5 mb-3 text-center">
              <p className="text-ivory text-[.85rem] mb-2.5">برای ثبت در جدول برترین‌ها وارد حساب بشو.</p>
              <div className="flex gap-2">
                <Link href="/login" onClick={onClose}
                  className="flex-1 text-center bg-green/10 border border-green-dim text-green no-underline text-[.82rem] font-semibold py-2 rounded-lg">ورود</Link>
                <Link href="/register" onClick={onClose}
                  className="flex-1 text-center bg-green text-[#04140a] no-underline text-[.82rem] font-bold py-2 rounded-lg">ثبت‌نام</Link>
              </div>
            </div>
          )}

          {user && !alreadySubmitted && roundsCompleted !== null && (
            <div className="flex items-center gap-2 mb-3">
              <span className="flex-1 bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.88rem] px-3 h-10 flex items-center justify-center truncate">
                {profile?.username || "..."}
              </span>
              <button onClick={handleSubmit} disabled={submitting || !profile?.username}
                className="shrink-0 bg-green text-[#04140a] border-none rounded-[9px] px-3.5 text-[.82rem] font-bold cursor-pointer disabled:opacity-50">
                ثبت در جدول
              </button>
            </div>
          )}

          {submitError && (
            <p className="text-[.8rem] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-center">
              {submitError}
            </p>
          )}

          <h3 className="font-display font-normal text-[1.1rem] text-green m-0 mb-2">جدول برترین‌ها</h3>
          <LeaderboardList
            entries={leaderboard}
            loading={leaderboardLoading}
            emptyNoun="بازی"
            renderExtra={(e) => (
              <span className="text-green font-bold text-[.85rem] flex-shrink-0">
                {toPersianDigits(e.score)}/۳
              </span>
            )}
          />
        </div>
      </div>
    </div>
  );
}
