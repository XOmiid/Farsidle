"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { rgbToHex } from "@/lib/colordle/logic";
import { toPersianDigits } from "@/lib/shared/persian";
import LeaderboardList from "@/components/common/LeaderboardList";

export default function ColordleResultModal({
  open,
  colorName,
  score,
  target,
  guess,
  leaderboard,
  leaderboardLoading,
  highlightIndex,
  onClose,
}) {
  const { user } = useAuth();
  if (!open) return null;

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

        <h2 className="font-display text-[1.7rem] m-0 mb-1">امتیازت</h2>
        <div className="text-[3rem] font-extrabold text-green leading-none my-2">
          {toPersianDigits(score)}
          <span className="text-lg text-ivory-dim">/۱۰</span>
        </div>
        <p className="text-ivory-dim text-[.85rem] mb-4">{colorName}</p>

        <div className="flex gap-4 justify-center mb-4">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-20 h-20 rounded-xl border-2 border-green-dim"
              style={{ background: target ? rgbToHex(target.r, target.g, target.b) : "transparent" }}
            />
            <span className="text-[.72rem] text-ivory-dim">رنگ درست</span>
          </div>
          {guess && (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-20 h-20 rounded-xl border-2 border-border"
                style={{ background: rgbToHex(guess.r, guess.g, guess.b) }}
              />
              <span className="text-[.72rem] text-ivory-dim">حدس تو</span>
            </div>
          )}
        </div>

        <div className="my-3.5 text-right">
          {!user && (
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

          <h3 className="font-display font-normal text-[1.1rem] text-green m-0 mb-2">
            جدول برترین‌ها
          </h3>
          <LeaderboardList
            entries={leaderboard}
            highlightIndex={highlightIndex}
            loading={leaderboardLoading}
            emptyNoun="رنگ"
            renderExtra={(e) => (
              <span className="text-green font-bold text-[.85rem] flex-shrink-0">
                {toPersianDigits(e.score)}/۱۰
              </span>
            )}
          />
        </div>
      </div>
    </div>
  );
}
