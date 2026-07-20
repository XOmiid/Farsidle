"use client";

import { toPersianDigits } from "@/lib/shared/persian";

const LETTERS = ["a", "b", "c", "d"];
const LABELS = { a: "الف", b: "ب", c: "ج", d: "د" };

export default function BettingPanel({ question, totalGold, bets, onChangeBets, disabled, reveal }) {
  const allocated = LETTERS.reduce((sum, l) => sum + (bets[l] || 0), 0);
  const remaining = totalGold - allocated;

  const setBet = (letter, value) => {
    const n = Math.max(0, Math.min(totalGold, Math.floor(Number(value) || 0)));
    onChangeBets({ ...bets, [letter]: n });
  };

  const allIn = (letter) => {
    const next = { a: 0, b: 0, c: 0, d: 0 };
    next[letter] = totalGold;
    onChangeBets(next);
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col gap-3">
      <p className="text-ivory text-[1.05rem] leading-8 text-right font-semibold">
        {question.question_fa}
      </p>

      {!reveal && (
        <div
          className={`text-center text-[.85rem] rounded-lg py-2 border ${
            remaining === 0
              ? "border-green-dim text-green bg-green/10"
              : "border-yellow text-yellow bg-yellow/10"
          }`}
        >
          {remaining === 0
            ? "همه‌ی طلات تخصیص داده شد ✓"
            : `${toPersianDigits(remaining)} طلا هنوز تخصیص داده نشده`}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {LETTERS.map((letter) => {
          const isCorrect = reveal?.correct_choice === letter;
          const hadBet = (bets[letter] || 0) > 0;
          const cardClass = reveal
            ? isCorrect
              ? "border-green bg-green/[.14]"
              : hadBet
              ? "border-red bg-red/[.08]"
              : "border-border bg-white/[.02] opacity-60"
            : "border-green-dim bg-bg-1";

          return (
            <div key={letter} className={`border rounded-xl p-3.5 ${cardClass}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-ivory-dim text-[.72rem] font-bold flex-shrink-0">
                  {LABELS[letter]}
                </span>
                <span className="text-ivory text-[.9rem] flex-1 text-right">
                  {question[`choice_${letter}`]}
                </span>
                {reveal && isCorrect && <span className="text-green flex-shrink-0">✓ درست</span>}
              </div>

              {!reveal && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => allIn(letter)}
                    disabled={disabled}
                    className="text-[.72rem] bg-green/10 border border-green-dim text-green rounded-md px-2 py-1.5 cursor-pointer disabled:opacity-40 flex-shrink-0"
                  >
                    همه رو اینجا بذار
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={totalGold}
                    value={bets[letter] || 0}
                    disabled={disabled}
                    onChange={(e) => setBet(letter, e.target.value)}
                    className="flex-1 bg-white/[.04] border border-green-dim rounded-lg text-ivory text-[.9rem] px-3 h-10 text-center focus:outline-none focus:border-green disabled:opacity-40"
                  />
                  <span className="text-ivory-dim text-[.75rem] flex-shrink-0">طلا</span>
                </div>
              )}

              {reveal && hadBet && (
                <p className="text-[.78rem] text-ivory-dim text-right mt-1">
                  {toPersianDigits(bets[letter])} طلا گذاشتی
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
