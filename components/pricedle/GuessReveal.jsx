"use client";

import { toPersianDigits } from "@/lib/shared/persian";

function formatToman(n) {
  if (n >= 1_000_000_000) return `${toPersianDigits((n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1))} میلیارد تومان`;
  if (n >= 1_000_000)     return `${toPersianDigits((n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1))} میلیون تومان`;
  if (n >= 1_000)         return `${toPersianDigits((n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1))} هزار تومان`;
  return `${toPersianDigits(n)} تومان`;
}

export default function GuessReveal({ score, correctAnswer, guess, onContinue, gameOver }) {
  const pct = Math.round((score / 100) * 100);

  const color = score >= 80 ? "text-green" : score >= 50 ? "text-yellow" : "text-red-400";
  const msg = score === 100
    ? "دقیقاً درست! 🎯"
    : score >= 80 ? "خیلی نزدیک بود! 🔥"
    : score >= 50 ? "نه بد! 👍"
    : score >= 20 ? "دور بود 😅"
    : "خیلی دور بود 😬";

  return (
    <div className="w-full max-w-[420px] bg-bg-1 border border-green-dim rounded-2xl p-5 text-center">
      <p className={`text-[2rem] font-extrabold ${color} leading-none mb-1`}>
        {toPersianDigits(score)}/۱۰۰
      </p>
      <p className="text-ivory-dim text-[.85rem] mb-3">{msg}</p>

      {/* Bar */}
      <div className="w-full h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: score >= 80 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171",
          }}
        />
      </div>

      <div className="flex flex-col gap-1 text-right mb-4">
        <div className="flex justify-between text-[.85rem]">
          <span className="text-ivory-dim">حدس شما:</span>
          <span className="text-ivory font-medium">{formatToman(guess)}</span>
        </div>
        <div className="flex justify-between text-[.85rem]">
          <span className="text-ivory-dim">قیمت واقعی:</span>
          <span className="text-green font-bold">{formatToman(correctAnswer)}</span>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-green text-[#04140a] border-none rounded-xl py-2.5 font-bold text-[.9rem] cursor-pointer"
      >
        {gameOver ? "دیدن نتیجه نهایی" : "سوال بعدی ←"}
      </button>
    </div>
  );
}
