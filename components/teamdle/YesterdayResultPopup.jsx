"use client";

import { toPersianDigits } from "@/lib/shared/persian";

export default function YesterdayResultPopup({ result, open, onClose }) {
  if (!open || !result || !result.played) return null;

  const won = result.winner === result.your_team;
  const draw = result.winner === "draw";
  const teamLabel = result.your_team === "red" ? "🔴 قرمز" : "🔵 آبی";
  const winnerLabel = result.winner === "draw" ? "مساوی" :
    result.winner === "red" ? "🔴 قرمز" : "🔵 آبی";

  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.88)] flex items-center justify-center z-40 p-4">
      <div className={`bg-bg-1 border-2 rounded-2xl max-w-[360px] w-full text-center p-6 ${
        draw ? "border-yellow" : won ? "border-green" : "border-red-500/60"
      }`}>
        <div className="text-[3rem] mb-2">
          {draw ? "🤝" : won ? "🏆" : "😔"}
        </div>
        <h2 className="font-display text-[1.5rem] mb-1">نتیجه‌ی دیروز</h2>
        <p className="text-ivory-dim text-[.85rem] mb-4">تیم تو: {teamLabel}</p>

        {/* Score display */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className={`flex flex-col items-center px-5 py-3 rounded-xl border ${
            result.winner === "red" ? "border-red-400 bg-red-500/10" : "border-border bg-white/[.03]"
          }`}>
            <span className="text-[.75rem] text-ivory-dim mb-1">🔴 قرمز</span>
            <span className="text-[1.8rem] font-extrabold text-ivory">{toPersianDigits(result.red_score)}</span>
          </div>
          <span className="text-ivory-dim text-lg font-bold">در برابر</span>
          <div className={`flex flex-col items-center px-5 py-3 rounded-xl border ${
            result.winner === "blue" ? "border-blue-400 bg-blue-500/10" : "border-border bg-white/[.03]"
          }`}>
            <span className="text-[.75rem] text-ivory-dim mb-1">🔵 آبی</span>
            <span className="text-[1.8rem] font-extrabold text-ivory">{toPersianDigits(result.blue_score)}</span>
          </div>
        </div>

        {/* Result message */}
        <div className={`rounded-xl px-4 py-3 mb-4 ${
          draw ? "bg-yellow/10 border border-yellow" :
          won ? "bg-green/10 border border-green" :
          "bg-red-500/10 border border-red-500/40"
        }`}>
          {draw ? (
            <p className="text-yellow font-bold">مساوی شد! هر دو تیم {toPersianDigits(75)} سکه گرفتن</p>
          ) : won ? (
            <p className="text-green font-bold">تیم {winnerLabel} برنده شد! تو {toPersianDigits(150)} سکه گرفتی 🎉</p>
          ) : (
            <p className="text-red-400 font-bold">تیم {winnerLabel} برنده شد. بهتر از این هم می‌شه!</p>
          )}
        </div>

        <button onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-xl py-2.5 font-bold text-[.9rem] cursor-pointer">
          باشه، بزن بریم به امروز!
        </button>
      </div>
    </div>
  );
}
