"use client";

import Link from "next/link";
import { useState } from "react";
import { toPersianDigits } from "@/lib/wordle/logic";
import { useAuth } from "@/lib/auth/AuthProvider";
import LeaderboardList from "@/components/common/LeaderboardList";
import StreakBadge from "@/components/common/StreakBadge";

export default function ResultModal({
  open,
  won,
  answer,
  tries,
  streak,
  leaderboard,
  leaderboardLoading,
  highlightIndex,
  alreadySubmitted,
  submitError,
  onClose,
  onSubmitScore,
  emptyLeaderboardNoun = "کلمه",
  loseAnswerText = "کلمه‌ی درست این بود",
}) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmitScore();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto">
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[420px] w-full text-center">
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer"
        >
          ✕
        </button>

        <h2 className="font-display text-[1.7rem] m-0 mb-2">
          {won ? "آفرین! 🎉" : "دفعه‌ی بعد بهتر می‌شی"}
        </h2>
        <div className="text-[2rem] font-extrabold text-green tracking-[2px] my-2.5">{answer}</div>
        <p className="text-ivory-dim text-[.85rem] mb-1">
          {won ? `در ${toPersianDigits(tries)} تلاش حدس زدی` : loseAnswerText}
        </p>
        {won && streak >= 2 && (
          <p className="mb-3">
            <StreakBadge streak={streak} className="text-base" /> <span className="text-ivory-dim text-[.8rem]">روز پشت‌سرهم!</span>
          </p>
        )}
        {(!won || streak < 2) && <div className="mb-3" />}

        <div className="my-3.5 text-right">
          {won && !user && (
            <div className="border border-green-dim bg-green/[.06] rounded-xl p-3.5 mb-3 text-center">
              <p className="text-ivory text-[.85rem] mb-2.5">
                برای دیدن اسمت تو جدول برترین‌ها، اول وارد حساب بشو.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={onClose}
                  className="flex-1 text-center bg-green/10 border border-green-dim text-green no-underline text-[.82rem] font-semibold py-2 rounded-lg"
                >
                  ورود
                </Link>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="flex-1 text-center bg-green text-[#04140a] no-underline text-[.82rem] font-bold py-2 rounded-lg"
                >
                  ثبت‌نام
                </Link>
              </div>
            </div>
          )}

          {won && user && !alreadySubmitted && (
            <div className="flex items-center gap-2 mb-3">
              <span className="flex-1 min-w-0 bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.88rem] px-3 h-10 flex items-center justify-center truncate">
                {profile?.username || "..."}
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || !profile?.username}
                className="shrink-0 bg-green text-[#04140a] border-none rounded-[9px] px-3.5 text-[.82rem] font-bold cursor-pointer disabled:opacity-50"
              >
                ثبت در جدول
              </button>
            </div>
          )}

          {submitError && (
            <p className="text-[.8rem] text-red bg-red/10 border border-red/30 rounded-lg px-3 py-2 mb-3 text-center">
              {submitError}
            </p>
          )}

          <h3 className="font-display font-normal text-[1.1rem] text-green m-0 mb-2">
            جدول برترین‌ها
          </h3>
          <LeaderboardList
            entries={leaderboard}
            highlightIndex={highlightIndex}
            loading={leaderboardLoading}
            emptyNoun={emptyLeaderboardNoun}
          />
        </div>
      </div>
    </div>
  );
}
